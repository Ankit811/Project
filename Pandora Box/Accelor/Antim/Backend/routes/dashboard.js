import express from 'express';
import mongoose from 'mongoose';
import Employee from '../models/Employee.js';
import Attendance from '../models/Attendance.js';
import Leave from '../models/Leave.js';
import { auth } from '../middleware/auth.js';
import role from '../middleware/role.js';
import OT from '../models/OTClaim.js';
import { normalizeDate } from '../utils/date.js';
import { calculateDays, deduplicateLeaves } from '../utils/Leave/leave.js';
import { buildAttendanceData } from '../utils/Attendance/attendanceUtils.js';
import { separateOTRecords } from '../utils/Attendance/ot.js';
import isEligibleForOT from '../utils/Attendance/otEligibleDep.js';
const router = express.Router();

router.get('/stats', auth, role(['Admin', 'CEO', 'HOD']), async (req, res) => {
    try {
        const { loginType, employeeId } = req.user;
        let departmentId = null;

        if (loginType === 'HOD') {
            const hod = await Employee.findOne({ employeeId }).select('department');
            if (!hod || !hod.department || !hod.department._id) {
                return res.status(400).json({ message: 'HOD department not found' });
            }
            departmentId = hod.department._id;
        }

        const today = normalizeDate(new Date());
        const tomorrow = new Date(today);
        tomorrow.setDate(today.getDate() + 1);

        const employeeMatch = departmentId ? { department: departmentId, status: 'Working' } : { status: 'Working' };
        const employeeStats = await Employee.aggregate([
            { $match: employeeMatch },
            {
                $addFields: {
                    effectiveStatus: {
                        $cond: {
                            if: {
                                $and: [
                                    { $eq: ['$employeeType', 'Probation'] },
                                    { $ne: ['$confirmationDate', null] },
                                    { $lte: ['$confirmationDate', new Date()] },
                                ],
                            },
                            then: 'Confirmed',
                            else: '$employeeType',
                        },
                    },
                },
            },
            {
                $group: {
                    _id: '$effectiveStatus',
                    count: { $sum: 1 },
                },
            },
        ]);

        const employeeCounts = {
            Confirmed: 0,
            Probation: 0,
            Contractual: 0,
            Intern: 0,
        };
        employeeStats.forEach(stat => {
            if (stat._id && ['Confirmed', 'Probation', 'Contractual', 'Intern'].includes(stat._id)) {
                employeeCounts[stat._id] = stat.count;
            }
        });

        const attendanceMatch = {
            logDate: { $gte: today, $lt: tomorrow },
            status: 'Present',
        };
        if (departmentId) {
            const deptEmployees = await Employee.find({ department: departmentId }).select('employeeId');
            attendanceMatch.employeeId = { $in: deptEmployees.map(e => e.employeeId) };
        }
        const presentToday = await Attendance.countDocuments(attendanceMatch);

        let leaveMatch = {};
        if (loginType === 'Admin') {
            leaveMatch = {
                'status.ceo': 'Approved',
                'status.admin': 'Pending',
                employee: { $nin: await Employee.find({ loginType: 'Admin' }).select('_id') }
            };
        } else if (loginType === 'CEO') {
            leaveMatch = {
                'status.hod': 'Approved',
                'status.ceo': 'Pending',
            };
        } else if (loginType === 'HOD') {
            leaveMatch = {
                'status.hod': 'Pending',
                departmentId,
                employee: { $nin: await Employee.find({ loginType: { $in: ['HOD', 'Admin'] } }).select('_id') }
            };
        }
        const pendingLeaves = await Leave.countDocuments(leaveMatch);

        const stats = {
            confirmedEmployees: employeeCounts.Confirmed,
            probationEmployees: employeeCounts.Probation,
            contractualEmployees: employeeCounts.Contractual,
            internEmployees: employeeCounts.Intern,
            presentToday,
            pendingLeaves,
        };

        res.json(stats);
    } catch (err) {
        res.status(500).json({ message: 'Server error', error: err.message });
    }
});

// Endpoint for employee info
router.get('/employee-info', auth, role(['Employee', 'HOD', 'Admin']), async (req, res) => {
    try {
        const { employeeId } = req.user;
        const employee = await Employee.findOne({ employeeId })
            .select('employeeType paidLeaves restrictedHolidays compensatoryLeaves department')
            .populate('department', 'name');
        if (!employee) {
            return res.status(404).json({ message: 'Employee not found' });
        }
        res.json({
            employeeType: employee.employeeType,
            paidLeaves: employee.paidLeaves,
            restrictedHolidays: employee.restrictedHolidays,
            compensatoryLeaves: employee.compensatoryLeaves,
            department: employee.department,
        });
    } catch (err) {
        res.status(500).json({ message: 'Server error', error: err.message });
    }
});

// Endpoint for employee dashboard stats
router.get('/employee-stats', auth, role(['Employee', 'HOD', 'Admin']), async (req, res) => {
    try {
        const { employeeId } = req.user;
        const { attendanceView, fromDate, toDate } = req.query;

        if (!fromDate || !toDate) {
            return res.status(400).json({ message: 'fromDate and toDate are required' });
        }

        if (!['daily', 'monthly', 'yearly'].includes(attendanceView)) {
            return res.status(400).json({ message: 'Invalid attendanceView. Must be "daily", "monthly", or "yearly"' });
        }

        const today = new Date();
        const startOfMonth = new Date(today.getFullYear(), today.getMonth(), 1);
        const endOfMonth = new Date(today.getFullYear(), today.getMonth() + 1, 0);
        endOfMonth.setHours(23, 59, 59, 999);
        const startOfYear = new Date(today.getFullYear(), 0, 1);
        const endOfYear = new Date(today.getFullYear(), 11, 31);
        endOfYear.setHours(23, 59, 59, 999);

        const attendanceQuery = {
            employeeId,
            logDate: { $gte: new Date(fromDate), $lte: new Date(toDate) },
            status: 'Present',
        };
        const attendanceRecords = await Attendance.find(attendanceQuery);

        const attendanceData = buildAttendanceData(attendanceRecords, attendanceView, fromDate, toDate);

        const employee = await Employee.findOne({ employeeId })
            .select('employeeType department compensatoryAvailable')
            .populate('department');
        if (!employee) {
            return res.status(404).json({ message: 'Employee not found' });
        }

        let leaveDaysTaken = { monthly: 0, yearly: 0 };
        if (employee.employeeType === 'Confirmed') {
            const leaveQueryBase = {
                employeeId,
                leaveType: { $in: ['Casual', 'Medical', 'Maternity', 'Paternity'] },
                'status.hod': 'Approved',
                'status.admin': 'Approved',
                'status.ceo': 'Approved',
            };
            const leavesThisMonth = await Leave.find({
                ...leaveQueryBase,
                $or: [
                    { 'fullDay.from': { $gte: startOfMonth, $lte: endOfMonth } },
                    { 'halfDay.date': { $gte: startOfMonth, $lte: endOfMonth } },
                ],
            });
            const leavesThisYear = await Leave.find({
                ...leaveQueryBase,
                $or: [
                    { 'fullDay.from': { $gte: startOfYear, $lte: endOfYear } },
                    { 'halfDay.date': { $gte: startOfYear, $lte: endOfYear } },
                ],
            });

            const deduplicatedLeaves = deduplicateLeaves(leavesThisMonth);
            leaveDaysTaken.monthly = deduplicatedLeaves.reduce((total, leave) => total + calculateDays(leave), 0);
            leaveDaysTaken.yearly = leavesThisYear.reduce((total, leave) => total + calculateDays(leave), 0);
        }

        const unpaidLeavesQuery = {
            employeeId,
            leaveType: 'Leave Without Pay(LWP)',
            $or: [
                { 'fullDay.from': { $gte: startOfMonth, $lte: endOfMonth } },
                { 'halfDay.date': { $gte: startOfMonth, $lte: endOfMonth } },
            ],
            'status.hod': 'Approved',
            'status.admin': 'Approved',
            'status.ceo': 'Approved',
        };
        const restrictedHolidaysTaken = employee.restrictedHolidays || 0;
        const unpaidLeavesRecords = await Leave.find(unpaidLeavesQuery);
        const unpaidLeavesTaken = unpaidLeavesRecords.reduce((total, leave) => {
            return total + calculateDays(leave);
        }, 0);

        const leaveRecords = await Leave.find({ employeeId })
            .sort({ createdAt: -1 })
            .limit(10)
            .reverse()
            .lean()
            .then(records => records.map(leave => ({
                type: leave.leaveType,
                fromDate: (leave.fullDay?.from || leave.halfDay?.date || '').toISOString().slice(0, 10),
                toDate: (leave.fullDay?.to || leave.halfDay?.date || '').toISOString().slice(0, 10),
                status: leave.status?.ceo || leave.status?.admin || leave.status?.hod || 'Pending',
            })));

        // Fetch OT claims (approved only)
        const otQuery = {
            employeeId,
            date: { $gte: startOfMonth, $lte: endOfMonth },
            'status.ceo': 'Approved',
        };
        const otRecords = await OT.find(otQuery);
        const overtimeHours = otRecords.reduce((sum, ot) => sum + (ot.hours || 0), 0);

        const otClaimRecords = await OT.find({ employeeId })
            .sort({ createdAt: -1 })
            .limit(10);

        // Fetch unclaimed and claimed OT entries from Attendance for eligible departments

        let unclaimedOTRecords = [];
        let claimedOTRecords = [];

        if (isEligibleForOT(employee.department?.name)) {
            // Fetch all attendance records with OT
            const otAttendanceQuery = {
                employeeId,
                logDate: { $gte: new Date(fromDate), $lte: new Date(toDate) },
                ot: { $gt: 0 }, // OT in minutes
            };
            const otAttendanceRecords = await Attendance.find(otAttendanceQuery).sort({ logDate: -1 });

            // Fetch all OT claims for the employee in the date range
            const otClaims = await OT.find({
                employeeId,
                date: { $gte: new Date(fromDate), $lte: new Date(toDate) },
            });

            // Separate unclaimed and claimed OT
            const otSeparation = separateOTRecords(otAttendanceRecords, otClaims);
            unclaimedOTRecords = otSeparation.unclaimedOTRecords;
            claimedOTRecords = otSeparation.claimedOTRecords;
        }

        // Fetch compensatory leave entries
        const compensatoryLeaveEntries = employee.compensatoryAvailable
            ? employee.compensatoryAvailable
                .filter((entry) => entry.status === 'Available')
                .map((entry) => ({
                    date: entry.date,
                    hours: entry.hours,
                    _id: entry._id || new mongoose.Types.ObjectId().toString(), // Ensure unique ID
                }))
            : [];

        // Fetch OD records
        const odRecords = await OD.find({employeeId})
            .sort({ createdAt: -1 })
            .limit(10)
            .lean()
            .then(records => records.map(od => ({
                date: od.date.toISOString().slice(0, 10),
                reason: od.reason,
                status: od.status || 'Pending',
            })));

        const stats = {
            attendanceData,
            leaveRecords,
            unpaidLeavesTaken,
            overtimeHours,
            otClaimRecords,
            unclaimedOTRecords,
            claimedOTRecords,
            compensatoryLeaveEntries,
            restrictedHolidaysTaken,
            compensatoryLeaves: employee.compensatoryLeaves || 0,

        };

        res.json(stats);
    } catch (err) {
        res.status(500).json({ message: 'Server error', error: err.message });
    }
});

export default router;

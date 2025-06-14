import { Router } from 'express';
import OTClaim from '../models/OTClaim.js';
import Employee from '../models/Employee.js';
import Notification from '../models/Notification.js';
import Audit from '../models/Audit.js';
import Attendance from '../models/Attendance.js';
import auth from '../middleware/auth.js';
import role from '../middleware/role.js'; 
const router = Router();

// Submit OT Claim (unchanged)
router.post('/', auth, role(['Employee', 'HOD', 'Admin']), async (req, res) => {
  try {
    const employee = await Employee.findById(req.user.id).populate('department');
    if (!employee) return res.status(404).json({ error: 'Employee not found' });
    if (!employee.department) return res.status(400).json({ error: 'Employee department is required' });

    const { date, hours, projectDetails, claimType } = req.body;
    if (!date || !hours || !projectDetails) {
      return res.status(400).json({ error: 'Date, hours, and project details are required' });
    }

    const otDate = new Date(date);
    if (isNaN(otDate.getTime())) return res.status(400).json({ error: 'Invalid date' });
    if (hours <= 0 || hours > 24) return res.status(400).json({ error: 'Hours must be between 0 and 24' });
    if (hours < 1) return res.status(400).json({ error: 'Hours must be at least 1' });

    const normalizeDate = (d) => {
      const date = new Date(d);
      return new Date(date.getFullYear(), date.getMonth(), date.getDate());
    };
    const normalizedOtDate = normalizeDate(otDate);
    const now = new Date();
    const claimDeadline = new Date(normalizedOtDate);
    claimDeadline.setDate(claimDeadline.getDate() + 1);
    claimDeadline.setHours(23, 59, 59, 999);

    if (now > claimDeadline) {
      return res.status(400).json({ error: 'OT claim must be submitted by 11:59 PM the next day' });
    }

    const eligibleDepartments = ['Production', 'Mechanical', 'AMETL'];
    const isEligible = eligibleDepartments
      .map(d => d.toLowerCase())
      .includes(employee.department?.name?.toLowerCase());
    let attendanceRecord;
    if (isEligible) {
      attendanceRecord = await Attendance.findOne({
        employeeId: employee.employeeId,
        logDate: { $gte: normalizedOtDate, $lte: normalizedOtDate },
        ot: { $gte: 60 }
      });
      if (!attendanceRecord) {
        return res.status(400).json({ error: 'No OT recorded for this date' });
      }
      const recordedOtHours = attendanceRecord.ot / 60;
      if (hours > recordedOtHours) {
        return res.status(400).json({ error: `Claimed hours (${hours}) exceed recorded OT (${recordedOtHours.toFixed(1)})` });
      }
      if (recordedOtHours > 4 && !claimType) {
        return res.status(400).json({ error: 'Claim type (Full/Partial) is required for OT > 4 hours' });
      }
      if (claimType === 'Partial' && hours !== recordedOtHours - (recordedOtHours >= 8 ? 8 : 4)) {
        return res.status(400).json({ error: `Partial claim must be for ${recordedOtHours - (recordedOtHours >= 8 ? 8 : 4)} hours` });
      }
    } else {
      if (otDate.getDay() !== 0) {
        return res.status(400).json({ error: 'OT claims for non-eligible departments are only allowed for Sundays' });
      }
      attendanceRecord = await Attendance.findOne({
        employeeId: employee.employeeId,
        logDate: { $gte: normalizedOtDate, $lte: normalizedOtDate },
      });
      if (!attendanceRecord) {
        return res.status(400).json({ error: 'No attendance recorded for this date' });
      }
      const recordedOtHours = attendanceRecord.ot / 60;
      if (hours > recordedOtHours) {
        return res.status(400).json({ error: `Claimed hours (${hours}) exceed recorded OT (${recordedOtHours.toFixed(1)})` });
      }
      if (hours < 4) {
        return res.status(400).json({ error: 'Compensatory leave requires at least 4 hours' });
      }
    }

    let compensatoryHours = 0;
    let paymentAmount = 0;
    if (isEligible) {
      if (!claimType || claimType === 'Full') {
        paymentAmount = hours * 500 * 1.5;
      } else if (claimType === 'Partial') {
        paymentAmount = (hours - (attendanceRecord.ot >= 8 * 60 ? 8 : 4)) * 500 * 1.5;
        compensatoryHours = attendanceRecord.ot >= 8 * 60 ? 8 : 4;
      }
    } else {
      compensatoryHours = hours >= 4 && hours < 8 ? 4 : hours >= 8 ? 8 : 0;
    }

    const status = {
      hod: req.user.role === 'Employee' ? 'Pending' : 'Approved',
      admin: 'Pending',
      ceo: 'Pending',
    };
    if (req.user.role === 'HOD' || req.user.role === 'Admin') {
      status.hod = 'Approved';
    }

    const otClaim = new OTClaim({
      employeeId: employee.employeeId,
      employee: employee._id,
      name: employee.name,
      department: employee.department._id,
      date: otDate,
      hours,
      projectDetails,
      compensatoryHours,
      paymentAmount,
      status,
      claimType: isEligible ? (claimType || 'Full') : null,
    });

    await otClaim.save();

    // Notify the next approver (HOD or CEO) based on the approval hierarchy
    if (req.user.role === 'Employee') {
      const hod = await Employee.findOne({
        department: employee.department._id,
        loginType: 'HOD',
      });
      if (hod) {
        await Notification.create({
          userId: hod.employeeId,
          message: `New OT claim from ${employee.name} awaits your approval`,
        });
        if (global._io) {
          global._io
            .to(hod.employeeId)
            .emit('notification', {
              message: `New OT claim from ${employee.name} awaits your approval`,
            });
        }
      }
    } else if (req.user.role === 'HOD' || req.user.role === 'Admin') {
      const ceo = await Employee.findOne({ loginType: 'CEO' });
      if (ceo) {
        await Notification.create({
          userId: ceo.employeeId,
          message: `New OT claim from ${employee.name} awaits your approval`,
        });
        if (global._io) {
          global._io
            .to(ceo.employeeId)
            .emit('notification', {
              message: `New OT claim from ${employee.name} awaits your approval`,
            });
        }
      }
    }

    await Audit.create({
      user: { id: employee._id },
      action: 'Submit otclaim',
      details: `Submitted OT claim for ${hours} hours on ${otDate.toDateString()}`,
    });

    res.status(201).json(otClaim);
  } catch (err) {
    console.error('OT claim submit error:', err.stack);
    res.status(500).json({ error: 'Server error', message: err.message });
  }
});

// Approve OT Claim
router.put('/:id/approve', auth, role(['HOD', 'Admin', 'CEO']), async (req, res) => {
  try {
    const otClaim = await OTClaim.findById(req.params.id).populate('employee department');
    if (!otClaim) return res.status(404).json({ error: 'OT claim not found' });

    const employee = await Employee.findById(otClaim.employee._id).populate('department');
    if (!employee) return res.status(404).json({ error: 'Employee not found' });

    const { status } = req.body;
    let nextStage = '';
    let message = '';
    const validStatuses = req.user.role === 'Admin' ? ['Acknowledged'] : ['Approved', 'Rejected'];

    if (!validStatuses.includes(status)) {
      return res.status(400).json({ error: `Invalid status. Must be one of ${validStatuses.join(', ')}` });
    }

    if (req.user.role === 'HOD' && otClaim.status.hod === 'Pending' && req.user.department.equals(employee.department._id)) {
      if (otClaim.status.hod !== 'Pending') {
        return res.status(400).json({ error: 'OT claim is not pending HOD approval' });
      }
      otClaim.status.hod = status;
      if (status === 'Approved') {
        nextStage = 'ceo';
        message = `OT claim from ${employee.name} approved by HOD`;
      } else {
        message = `Your OT claim for ${new Date(otClaim.date).toDateString()} was rejected by HOD`;
      }
    } else if (req.user.role === 'CEO' && otClaim.status.hod === 'Approved' && otClaim.status.ceo === 'Pending') {
      if (otClaim.status.ceo !== 'Pending') {
        return res.status(400).json({ error: 'OT claim is not pending CEO approval' });
      }
      otClaim.status.ceo = status;
      if (status === 'Approved') {
        nextStage = employee.loginType === 'Admin' ? '' : 'admin';
        message = `OT claim from ${employee.name} approved by CEO`;
      } else {
        message = `Your OT claim for ${new Date(otClaim.date).toDateString()} was rejected by CEO`;
      }
    } else if (req.user.role === 'Admin' && otClaim.status.ceo === 'Approved' && otClaim.status.admin === 'Pending') {
      if (otClaim.status.admin !== 'Pending') {
        return res.status(400).json({ error: 'OT claim is not pending Admin acknowledgment' });
      }
      otClaim.status.admin = status;
      message = `Your OT claim for ${new Date(otClaim.date).toDateString()} was acknowledged by Admin`;
      if (status === 'Acknowledged') {
        const eligibleDepartments = ['Production', 'Mechanical', 'AMETL'];
        const isEligible = eligibleDepartments.includes(employee.department?.name);
        if (isEligible) {
          const attendance = await Attendance.findOne({
            employeeId: employee.employeeId,
            logDate: {
              $gte: new Date(otClaim.date).setHours(0, 0, 0, 0),
              $lte: new Date(otClaim.date).setHours(23, 59, 59, 999),
            },
          });
          if (attendance) {
            attendance._ot = 0;
            await attendance.save();
          }
          if (otClaim.compensatoryHours > 0) {
            await employee.addCompensatoryLeave(otClaim.date, otClaim.compensatoryHours);
          }
        } else {
          if (otClaim.compensatoryHours > 0) {
            await employee.addCompensatoryLeave(otClaim.date, otClaim.compensatoryHours);
          }
        }
      }
    } else {
      return res.status(403).json({ error: 'Not authorized to approve this OT claim' });
    }

    await otClaim.save();

    // Notify the employee of the approval/rejection/acknowledgment
    await Notification.create({
      userId: employee.employeeId,
      message,
    });
    if (global._io) {
      global._io
        .to(employee.employeeId)
        .emit('notification', { message });
    }

    // Notify the next approver only if the claim was approved and there is a next stage
    if ((status === 'Approved' || status === 'Acknowledged') && nextStage) {
      let nextApprover = null;
      if (nextStage === 'ceo') {
        nextApprover = await Employee.findOne({ loginType: 'CEO' });
      } else if (nextStage === 'admin') {
        nextApprover = await Employee.findOne({ loginType: 'Admin' });
        if (nextApprover) {
          await Notification.create({
            userId: nextApprover.employeeId,
            message: `OT claim from ${employee.name} awaits your acknowledgment`,
          });
          if (global._io) {
            global._io
              .to(nextApprover.employeeId)
              .emit('notification', {
                message: `OT claim from ${employee.name} awaits your acknowledgment`,
              });
          }
        }
      }
    }

    await Audit.create({
      user: { id: req.user.id },
      action: `${status} OT Claim`,
      details: `${status} OT claim for ${employee.name} on ${new Date(otClaim.date).toDateString()}`,
    });

    res.json(otClaim);
  } catch (err) {
    console.error('OT claim approval error:', err.stack);
    res.status(500).json({ error: 'Server error', message: err.message });
  }
});

// Get OT Claims with Pagination and Filtering (unchanged)
router.get('/', auth, role(['Employee', 'HOD', 'Admin', 'CEO']), async (req, res) => {
  try {
    const { status = 'all', fromDate, toDate, page = 1, limit = 10 } = req.query;
    const query = {};

    if (req.user.role === 'Employee') {
      query.employeeId = req.user.employeeId;
    } else if (req.user.role === 'HOD') {
      const hod = await Employee.findById(req.user.id).populate('department');
      if (!hod || !hod.department) {
        return res.status(400).json({ message: 'HOD has no valid department assigned' });
      }
      query.department = hod.department._id;
    } else if (req.user.role === 'CEO') {
      query['status.hod'] = 'Approved';
    } else if (req.user.role === 'Admin') {
      query['status.ceo'] = 'Approved';
    }

    if (status !== 'all') {
      query.$or = [
        { 'status.hod': status },
        { 'status.ceo': status },
        { 'status.admin': status },
      ];
    }

    if (fromDate) {
      query.date = { ...query.date, $gte: new Date(fromDate) };
    }
    if (toDate) {
      const toDateEnd = new Date(toDate);
      toDateEnd.setHours(23, 59, 59, 999);
      query.date = { ...query.date, $lte: toDateEnd };
    }

    const total = await OTClaim.countDocuments(query);
    const otClaims = await OTClaim.find(query)
      .populate('employee', 'name employeeId role department')
      .populate('department', 'name')
      .sort({ createdAt: -1 })
      .skip((parseInt(page) - 1) * parseInt(limit))
      .limit(parseInt(limit))
      .exec();

    let unclaimedOTRecords = [];
    if (req.user.role === 'Employee') {
      const records = await Attendance.find({
        employeeId: req.user.employeeId,
        ot: { $gt: 0 },
        logDate: { $gte: new Date().setDate(new Date().getDate() - 7) },
      }).lean();
      unclaimedOTRecords = records.map((record) => {
        const logDate = new Date(record.logDate);
        const claimDeadline = new Date(logDate);
        claimDeadline.setDate(claimDeadline.getDate() + 1);
        claimDeadline.setHours(23, 59, 59, 999);
        return {
          _id: record._id,
          date: logDate,
          hours: (record.ot / 60).toFixed(1),
          day: logDate.toLocaleDateString('en-US', { weekday: 'long' }),
          claimDeadline,
        };
      });
    }

    res.json({
      otClaims,
      unclaimedOTRecords,
      total,
      page: parseInt(page),
      limit: parseInt(limit),
    });
  } catch (err) {
    console.error('Error fetching OT claims:', err.stack);
    res.status(500).json({ error: 'Server error', message: err.message });
  }
});

export default router;

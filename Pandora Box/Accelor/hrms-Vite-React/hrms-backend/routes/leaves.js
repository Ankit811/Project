import { Router } from 'express';
import Leave from '../models/Leave.js';
import Employee from '../models/Employee.js';
import Notification from '../models/Notification.js';
import Audit from '../models/Audit.js';
import auth from '../middleware/auth.js';
import role from '../middleware/role.js';
const router = Router();

// Submit Leave
router.post('/', auth, role(['Employee', 'HOD', 'Admin']), async (req, res) => {
  try {
    const user = await Employee.findById(req.user.id);
    if (!user) {
      return res.status(404).json({ message: 'Employee not found' });
    }
    if (!user.designation) {
      return res.status(400).json({ message: 'Employee designation is required' });
    }
    if (!user.department) {
      return res.status(400).json({ message: 'Employee department is required' });
    }

    const currentYear = new Date().getFullYear();
    const today = new Date();
    today.setHours(0, 0, 0, 0); // Normalize to start of day

    const leaveDays = req.body.halfDay ? 0.5 :
      (req.body.fullDay?.from && req.body.fullDay?.to
        ? ((new Date(req.body.fullDay.to) - new Date(req.body.fullDay.from)) / (1000 * 60 * 60 * 24)) + 1
        : 0);
    if (leaveDays === 0 && !req.body.halfDay) {
      return res.status(400).json({ message: 'Invalid leave dates provided' });
    }

    let leaveStart, leaveEnd;
    if (req.body.halfDay?.date) {
      leaveStart = new Date(req.body.halfDay.date);
      leaveEnd = new Date(req.body.halfDay.date);
      if (leaveStart < today) {
        return res.status(400).json({ message: 'Half day date cannot be in the past' });
      }
    } else if (req.body.fullDay?.from && req.body.fullDay?.to) {
      leaveStart = new Date(req.body.fullDay.from);
      leaveEnd = new Date(req.body.fullDay.to);
      if (leaveStart < today) {
        return res.status(400).json({ message: 'Full day from date cannot be in the past' });
      }
      if (leaveStart > leaveEnd) {
        return res.status(400).json({ message: 'Leave start date cannot be after end date' });
      }
    } else {
      return res.status(400).json({ message: 'Either halfDay or fullDay dates are required' });
    }

    const leaveType = req.body.leaveType;
    const isConfirmed = user.employeeType === 'Confirmed';
    const joinDate = new Date(user.dateOfJoining);
    const yearsOfService = (new Date() - joinDate) / (1000 * 60 * 60 * 24 * 365);
    console.log('Leave Type:', leaveType, 'Employee Type:', user.employeeType, 'Leave Days:', leaveDays);

    switch (leaveType) {
      case 'Casual':
        const canTakeCasualLeave = await user.checkConsecutivePaidLeaves(leaveStart, leaveEnd);
        if (!canTakeCasualLeave) {
          return res.status(400).json({ message: 'Cannot take more than 3 consecutive paid leave days.' });
        }
        if (user.paidLeaves < leaveDays) {
          return res.status(400).json({ message: 'Insufficient Casual leave balance.' });
        }
        break;
      case 'Medical':
        if (!isConfirmed) return res.status(400).json({ message: 'Medical leave is only for confirmed employees.' });
        if (![3, 4].includes(leaveDays)) return res.status(400).json({ message: 'Medical leave must be either 3 or 4 days.' });
        if (user.medicalLeaves < leaveDays) return res.status(400).json({ message: 'Medical leave already used or insufficient balance for this year.' });
        const medicalLeavesThisYear = await Leave.find({
          employeeId: user.employeeId,
          leaveType: 'Medical',
          'status.admin': 'Acknowledged',
          $or: [
            { 'fullDay.from': { $gte: new Date(currentYear, 0, 1) } },
            { 'halfDay.date': { $gte: new Date(currentYear, 0, 1) } },
          ],
        });
        if (medicalLeavesThisYear.length > 0) {
          return res.status(400).json({ message: 'Medical leave can only be used once per year.' });
        }
        break;
      case 'Maternity':
        if (!isConfirmed || user.gender !== 'Female') return res.status(400).json({ message: 'Maternity leave is only for confirmed female employees.' });
        if (yearsOfService < 1) return res.status(400).json({ message: 'Must have completed one year of service.' });
        if (leaveDays !== 90) return res.status(400).json({ message: 'Maternity leave must be 90 days.' });
        if (user.maternityClaims >= 2) return res.status(400).json({ message: 'Maternity leave can only be availed twice during service.' });
        if (leaveDays > 3) {
          return res.status(400).json({ message: 'Cannot take more than 3 consecutive paid leave days.' });
        }
        break;
      case 'Paternity':
        if (!isConfirmed || user.gender !== 'Male') return res.status(400).json({ message: 'Paternity leave is only for confirmed male employees.' });
        if (yearsOfService < 1) return res.status(400).json({ message: 'Must have completed one year of service.' });
        if (leaveDays !== 7) return res.status(400).json({ message: 'Paternity leave must be 7 days.' });
        if (user.paternityClaims >= 2) return res.status(400).json({ message: 'Paternity leave can only be availed twice during service.' });
        if (leaveDays > 3) {
          return res.status(400).json({ message: 'Cannot take more than 3 consecutive paid leave days.' });
        }
        break;
      case 'Restricted Holidays':
        if (leaveDays !== 1) return res.status(400).json({ message: 'Restricted Holiday must be 1 day.' });
        if (user.restrictedHolidays < 1) return res.status(400).json({ message: 'Restricted Holiday already used for this year.' });
        const canTakeRestrictedLeave = await user.checkConsecutivePaidLeaves(leaveStart, leaveEnd);
        if (!canTakeRestrictedLeave) {
          return res.status(400).json({ message: 'Cannot take more than 3 consecutive paid leave days.' });
        }
        if (!req.body.restrictedHoliday) return res.status(400).json({ message: 'Restricted holiday must be selected.' });
        const existingRestrictedLeave = await Leave.findOne({
          employeeId: user.employeeId,
          leaveType: 'Restricted Holidays',
          $or: [
            { 'fullDay.from': { $gte: new Date(currentYear, 0, 1) } },
            { 'halfDay.date': { $gte: new Date(currentYear, 0, 1) } },
          ],
          $or: [
            { 'status.hod': { $in: ['Pending', 'Approved'] } },
            { 'status.ceo': { $in: ['Pending', 'Approved'] } },
            { 'status.admin': { $in: ['Pending', 'Acknowledged'] } },
          ],
        });
        if (existingRestrictedLeave) {
          return res.status(400).json({ message: 'A Restricted Holiday request already exists for this year.' });
        }
        break;
      case 'Compensatory':
        if (!req.body.compensatoryEntryId || !req.body.projectDetails) {
          return res.status(400).json({ message: 'Compensatory entry ID and project details are required' });
        }
        const entry = user.compensatoryAvailable.find(e => e._id.toString() === req.body.compensatoryEntryId && e.status === 'Available');
        if (!entry) {
          return res.status(400).json({ message: 'Invalid or unavailable compensatory leave entry' });
        }
        const hoursNeeded = leaveDays === 0.5 ? 4 : 8;
        if (entry.hours !== hoursNeeded) {
          return res.status(400).json({ message: `Selected entry (${entry.hours} hours) does not match leave duration (${leaveDays === 0.5 ? 'Half Day (4 hours)' : 'Full Day (8 hours)'})` });
        }
        break;
      case 'Leave Without Pay(LWP)':
        break;
      default:
        return res.status(400).json({ message: 'Invalid leave type.' });
    }

    const status = {
      hod: req.user.role === 'Employee' ? 'Pending' : 'Approved',
      ceo: 'Pending',
      admin: 'Pending'
    };
    if (req.user.role === 'HOD' || req.user.role === 'Admin') {
      status.hod = 'Approved';
    }

    const leave = new Leave({
      employeeId: user.employeeId,
      employee: user._id,
      name: user.name,
      designation: user.designation,
      department: user.department,
      leaveType: req.body.leaveType,
      halfDay: req.body.halfDay,
      fullDay: req.body.fullDay,
      reason: req.body.reason,
      chargeGivenTo: req.body.chargeGivenTo,
      emergencyContact: req.body.emergencyContact,
      compensatoryEntryId: req.body.compensatoryEntryId,
      projectDetails: req.body.projectDetails,
      restrictedHoliday: req.body.restrictedHoliday,
      status
    });

    await leave.save();

    if (req.user.role === 'HOD' || req.user.role === 'Admin') {
      const ceo = await Employee.findOne({ loginType: 'CEO' });
      if (ceo) {
        await Notification.create({ userId: ceo.employeeId, message: `New leave request from ${user.name}` });
        if (global._io) global._io.to(ceo.employeeId).emit('notification', { message: `New leave request from ${user.name}` });
      }
    } else {
      const hod = await Employee.findOne({ department: user.department, loginType: 'HOD' });
      if (hod) {
        await Notification.create({ userId: hod.employeeId, message: `New leave request from ${user.name}` });
        if (global._io) global._io.to(hod.employeeId).emit('notification', { message: `New leave request from ${user.name}` });
      }
    }

    await Audit.create({ user: user.employeeId, action: 'Submit Leave', details: 'Submitted leave request' });

    res.status(201).json(leave);
  } catch (err) {
    console.error('Leave submit error:', err.stack);
    res.status(500).json({ message: 'Server error', error: err.message });
  }
});

// Approve Leave
router.put('/:id/approve', auth, role(['HOD', 'CEO', 'Admin']), async (req, res) => {
  try {
    const leave = await Leave.findById(req.params.id).populate('employee');
    if (!leave) {
      return res.status(404).json({ message: 'Leave request not found' });
    }

    const user = await Employee.findById(req.user.id);
    if (!user) {
      return res.status(404).json({ message: 'User not found' });
    }

    const { status, remarks } = req.body;
    const currentStage = req.user.role.toLowerCase();
    const validStatuses = req.user.role === 'Admin' ? ['Acknowledged'] : ['Approved', 'Rejected'];

    if (!validStatuses.includes(status)) {
      return res.status(400).json({ message: `Invalid status. Must be one of ${validStatuses.join(', ')}` });
    }

    if (leave.status[currentStage] !== 'Pending') {
      return res.status(400).json({ message: `Leave is not pending ${currentStage.toUpperCase()} approval` });
    }

    if (status === 'Rejected' && ['hod', 'ceo'].includes(currentStage) && (!remarks || remarks.trim() === '')) {
      return res.status(400).json({ message: 'Remarks are required for rejection' });
    }

    if (req.user.role === 'HOD' && user.department.toString() !== leave.department.toString()) {
      return res.status(403).json({ message: 'Not authorized to approve leaves for this department' });
    }

    if (req.user.role === 'CEO' && leave.status.hod !== 'Approved') {
      return res.status(400).json({ message: 'Leave must be approved by HOD first' });
    }

    if (req.user.role === 'Admin' && leave.status.ceo !== 'Approved') {
      return res.status(400).json({ message: 'Leave must be approved by CEO first' });
    }

    leave.status[currentStage] = status;
    if (status === 'Rejected' && ['hod', 'ceo'].includes(currentStage)) {
      leave.remarks = remarks;
    }

    if (status === 'Approved' && currentStage === 'hod') {
      leave.status.ceo = 'Pending';
      const ceo = await Employee.findOne({ loginType: 'CEO' });
      if (ceo) {
        await Notification.create({
          userId: ceo.employeeId,
          message: `Leave request from ${leave.name} awaiting your approval`,
        });
        if (global._io) global._io.to(ceo.employeeId).emit('notification', { message: `Leave request from ${leave.name} awaiting your approval` });
      }
    }

    if (status === 'Approved' && currentStage === 'ceo') {
      leave.status.admin = 'Pending';
      const admin = await Employee.findOne({ loginType: 'Admin' });
      if (admin) {
        await Notification.create({
          userId: admin.employeeId,
          message: `Leave request from ${leave.name} awaiting your acknowledgment`,
        });
        if (global._io) global._io.to(admin.employeeId).emit('notification', { message: `Leave request from ${leave.name} awaiting your acknowledgment` });
      }
    }

    if (status === 'Acknowledged' && currentStage === 'admin') {
      const employee = leave.employee;
      switch (leave.leaveType) {
        case 'Casual':
          await employee.deductPaidLeaves(
            leave.fullDay?.from || leave.halfDay?.date,
            leave.fullDay?.to || leave.halfDay?.date
          );
          break;
        case 'Medical':
          employee.medicalLeaves -= leave.halfDay ? 0.5 :
            (leave.fullDay?.from && leave.fullDay?.to
              ? ((new Date(leave.fullDay.to) - new Date(leave.fullDay.from)) / (1000 * 60 * 60 * 24)) + 1
              : 0);
          break;
        case 'Maternity':
          employee.maternityClaims += 1;
          break;
        case 'Paternity':
          employee.paternityClaims += 1;
          break;
        case 'Restricted Holidays':
          employee.restrictedHolidays -= 1;
          break;
        case 'Compensatory':
          const entry = employee.compensatoryAvailable.find(e => e._id.toString() === leave.compensatoryEntryId.toString());
          if (entry) {
            entry.status = 'Used';
          }
          break;
        case 'Leave Without Pay(LWP)':
          break;
        default:
          return res.status(400).json({ message: 'Invalid leave type for balance update' });
      }

      await employee.save();

      await Notification.create({
        userId: employee.employeeId,
        message: `Your ${leave.leaveType} leave request has been acknowledged by Admin`,
      });
      if (global._io) global._io.to(employee.employeeId).emit('notification', { message: `Your ${leave.leaveType} leave request has been acknowledged by Admin` });
    }

    if (status === 'Rejected') {
      await Notification.create({
        userId: leave.employee.employeeId,
        message: `Your ${leave.leaveType} leave request was rejected by ${currentStage.toUpperCase()}`,
      });
      if (global._io) global._io.to(leave.employee.employeeId).emit('notification', { message: `Your ${leave.leaveType} leave request was rejected by ${currentStage.toUpperCase()}` });
    }

    await leave.save();

    await Audit.create({
      user: user.employeeId,
      action: `${status} Leave`,
      details: `${status} leave request for ${leave.name} by ${currentStage.toUpperCase()}`,
    });

    res.json({ message: `Leave ${status.toLowerCase()} successfully`, leave });
  } catch (err) {
    console.error('Leave approval error:', err.stack);
    res.status(500).json({ message: 'Server error', error: err.message });
  }
});

// Get Leaves
router.get('/', auth, async (req, res) => {
  try {
    const { leaveType, status, fromDate, toDate, page = 1, limit = 10 } = req.query;
    const user = await Employee.findById(req.user.id);
    if (!user) {
      return res.status(404).json({ message: 'User not found' });
    }

    const query = {};
    if (leaveType && leaveType !== 'all') query.leaveType = leaveType;
    if (status && status !== 'all') {
      query.$or = [
        { 'status.hod': status },
        { 'status.ceo': status },
        { 'status.admin': status },
      ];
    }
    if (fromDate || toDate) {
      query.$or = [
        { 'fullDay.from': {} },
        { 'fullDay.to': {} },
        { 'halfDay.date': {} },
      ];
      if (fromDate) {
        query.$or[0]['fullDay.from'].$gte = new Date(fromDate);
        query.$or[2]['halfDay.date'].$gte = new Date(fromDate);
      }
      if (toDate) {
        query.$or[1]['fullDay.to'].$lte = new Date(toDate);
        query.$or[2]['halfDay.date'].$lte = new Date(toDate);
      }
    }

    if (req.user.role === 'Employee') {
      query.employee = req.user.id;
    } else if (req.user.role === 'HOD') {
      query.department = user.department;
    }

    const leaves = await Leave.find(query)
      .populate('employee', 'name designation')
      .populate('department', 'name')
      .skip((page - 1) * limit)
      .limit(parseInt(limit))
      .sort({ createdAt: -1 });

    const total = await Leave.countDocuments(query);

    res.json({
      leaves,
      total,
      page: parseInt(page),
      limit: parseInt(limit),
    });
  } catch (err) {
    console.error('Fetch leaves error:', err.stack);
    res.status(500).json({ message: 'Server error', error: err.message });
  }
});

export default router;

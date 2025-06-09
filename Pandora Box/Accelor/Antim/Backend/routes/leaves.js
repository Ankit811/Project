import { Router } from 'express';
import Leave from '../models/Leave.js';
import Employee from '../models/Employee.js';
import {auth} from '../middleware/auth.js';
import role from '../middleware/role.js';
import { validateLeaveRequest } from '../utils/Leave/leaveValidations.js';
import { notifySubmission, notifyApproval } from '../utils/NotificationService.js';
import { logEmployeeAction } from '../utils/auditService.js';
import { approveLeave } from '../utils/Leave/leaveApproval.js';
import { buildLeaveFilter } from '../utils/Leave/leaveFilters.js';

const router = Router();

// Submit Leave
router.post('/', auth, role(['Employee', 'HOD', 'Admin']), async (req, res) => {
  try {
    const user = await Employee.findEmployeeById(req.user.id);
    if (!user) {
      return res.status(404).json({ message: 'Employee not found' });
    }

    await validateLeaveRequest(req, req.body);

    // Set status based on user role
    const status = {
      status: req.user.role === 'Employee' ? 'Pending' : 'Approved',
      admin: req.body.status === 'Pending'
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

    await notifySubmission(user, leave);

    await logEmployeeAction('Submit Leave', user.employeeId, user.employeeId , 'Submitted leave request');

    res.status(201).json(leave);
  } catch (err) {
    console.error('Leave submit error:', err.stack);
    res.status(500).json({ message: 'Server error', error: err.message });
  }
});

// Approve Leave
router.put('/:id/approve:id/approve', auth, role(['HOD', 'Admin', 'CEO']), async (req, res) => {
  try {
    const { leave, nextStage, approverMessage } = await approveLeave(req.body.params.id, req.user, req.body.status);

    await notifyApproval(leave, req.user, req.body.nextStage, leave.approverMessage);

    await logEmployeeAction(`${req.body.status} Leave`,'-', req.user.employeeId, `${req.body.status} leave for ${leave.name}`);

    res.json(leave);
  } catch (err) {
    console.error('Leave approval error:', err.stack);
    res.status(500).json({ message: 'Server error', error: err.message });
  }
});

// Get Leaves
router.get('/', auth, async (req, res) => {
  try {
    const filter = await buildLeaveFilter(req);
    const { page = 1, limit = 10 } = req.query;

    const skip = (parseInt(page) - 1) * parseInt(limit);
    const leaves = await Leave.findById(filter)
      .populate('department employee')
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(parseInt(limit));
    const total = await Leave.countDocuments(filter);

    console.log('Leaves found:', leaves.length, 'Total:', total);

    res.json({ leaves, total, page: parseInt(page), limit: parseInt(limit) });
  } catch (err) {
    console.error('Error fetching leaves:', err.stack);
    res.status(500).json({ message: 'Server error', error: err.message });
  }
});

export default router;
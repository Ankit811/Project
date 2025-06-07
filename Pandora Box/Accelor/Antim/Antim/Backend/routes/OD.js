import { Router } from 'express';
import OD  from '../models/OD.js';
import Employee from '../models/Employee.js';
import {auth} from '../middleware/auth.js';
import role from '../middleware/role.js';
import { validateODRequest } from '../utils/OD/odValidations.js';
import { notifySubmission, notifyApproval } from '../utils/NotificationService.js';
import { logEmployeeAction } from '../utils/auditService.js';
import { approveOD } from '../utils/OD/odApproval.js';
import { buildODFilter } from '../utils/OD/odFilters.js';

const router = Router();

// Submit OD
router.post('/', auth, role(['Employee', 'HOD', 'Admin']), async (req, res) => {
  try {
    const user = await Employee.findEmployeeById(req.user.id);
    if (!user) {
      return res.status(404).json({ message: 'Employee not found' });
    }

    const { dateOut, timeOut, dateIn, timeIn, purpose, placeUnitVisit } = validateODRequest(req, user);

    // Set status based on user role
    const status = {
      hod: req.user.role === 'Employee' ? 'Pending' : 'Approved',
      ceo: 'Pending',
      admin: 'Pending'
    };
    if (req.user.role === 'HOD' || req.user.role === 'Admin') {
      status.hod = 'Approved';
    }

    const od = new OD({
      employeeId: user.employeeId,
      employee: user._id,
      name: user.name,
      designation: user.designation,
      department: user.department,
      dateOut: new Date(dateOut),
      timeOut,
      dateIn: new Date(dateIn),
      timeIn,
      purpose,
      placeUnitVisit,
      status
    });

    await od.save();

    await notifySubmission(user, od, 'OD');

    await logEmployeeAction('Submit OD', user.employeeId, user.employeeId, 'Submitted OD request');

    res.status(201).json(od);
  } catch (err) {
    console.error('OD submit error:', err.stack);
    res.status(500).json({ message: 'Server error', error: err.message });
  }
});

// Approve OD
router.put('/:id/approve', auth, role(['HOD', 'Admin', 'CEO']), async (req, res) => {
  try {
    const { od, nextStage, approverMessage } = await approveOD(req.params.id, req.user, req.body.status);

    await notifyApproval(od, od.employee, nextStage, approverMessage, 'OD');

    await logEmployeeAction(`${req.body.status} OD`,'-', req.user.employeeId, `${req.body.status} OD for ${od.name}`);

    res.json(od);
  } catch (err) {
    console.error('OD approval error:', err.stack);
    res.status(500).json({ message: 'Server error', error: err.message });
  }
});

// Get OD Records
router.get('/', auth, async (req, res) => {
  try {
    const filter = await buildODFilter(req);
    const { page = 1, limit = 10 } = req.query;

    const skip = (parseInt(page) - 1) * parseInt(limit);
    const odRecords = await OD.find(filter)
      .populate('department employee')
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(parseInt(limit));
    const total = await OD.countDocuments(filter);

    res.json({ odRecords, total, page: parseInt(page), limit: parseInt(limit) });
  } catch (err) {
    console.error('Error fetching OD records:', err.stack);
    res.status(500).json({ message: 'Server error', error: err.message });
  }
});

export default router;
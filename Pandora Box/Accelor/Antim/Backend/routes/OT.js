import { Router } from 'express';
import OTClaim from '../models/OTClaim.js';
import Employee from '../models/Employee.js';
import {auth} from '../middleware/auth.js';
import role from '../middleware/role.js';
import { validateOTRequest } from '../utils/OT/otValidations.js';
import { notifySubmission, notifyApproval } from '../utils/NotificationService.js';
import { logEmployeeAction } from '../utils/auditService.js';
import { approveOT } from '../utils/OT/otApproval.js';
import { buildOTFilter, getUnclaimedOTRecords } from '../utils/OT/otFilter.js';

const router = Router();

// Submit OT Claim
router.post('/', auth, role(['Employee', 'HOD', 'Admin']), async (req, res) => {
  try {
    const employee = await Employee.findEmployeeById(req.user.id).populate('department');
    if (!employee) return res.status(404).json({ error: 'Employee not found' });

    const { date, hours, projectDetails, claimType, compensatoryHours, paymentAmount } = await validateOTRequest(req, employee);

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
      date,
      hours,
      projectDetails,
      compensatoryHours,
      paymentAmount,
      status,
      claimType
    });

    await otClaim.save();

    await notifySubmission(employee, otClaim, 'OT Claim');

    await logEmployeeAction('Submit OT Claim', employee.employeeId, employee.employeeId,  `Submitted OT claim for ${hours} hours on ${date.toISOString()}`);

    res.status(201).json(otClaim);
  } catch (err) {
    console.error('OT claim submit error:', err.stack);
    res.status(500).json({ error: 'Server error', error: err.message });
  }
});

// Approve OT Claim
router.put('/:id/approve', auth, role(['HOD', 'Admin', 'CEO']), async (req, res) => {
  try {
    const { otClaim, nextStage, approverMessage } = await approveOT(req.params.id, req.user, req.body.status);

    await notifyApproval(otClaim, await Employee.findEmployeeById(otClaim.employee), nextStage, approverMessage, 'OT Claim');

    await logEmployeeAction(`${req.body.status} OT Claim`, req.user.employeeId,  req.user.employeeId, `${req.body.status} OT claim for ${otClaim.name} on ${new Date(otClaim.date).toDateString()}`);

    res.json(otClaim);
  } catch (err) {
    console.error('OT claim approval error:', err.stack);
    res.status(500).json({ error: 'Server error', error: err.message });
  }
});

// Get OT Claims
router.get('/', auth, async (req, res) => {
  try {
    const filter = await buildOTFilter(req);
    const { page = 1, limit = 10 } = req.query;

    const skip = (parseInt(page) - 1) * parseInt(limit);
    const otClaims = await OTClaim.find(filter)
      .populate('department employee')
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(parseInt(limit));

    const unclaimedOTRecords = await getUnclaimedOTRecords(req.user);

    const total = await OTClaim.countDocuments(filter);

    res.json({ otClaims, unclaimedOTRecords, total, page: parseInt(page), limit: parseInt(limit) });
  } catch (err) {
    console.error('Error fetching OT claims:', err.stack);
    res.status(500).json({ error: 'Server error', error: err.message });
  }
});

export default router;
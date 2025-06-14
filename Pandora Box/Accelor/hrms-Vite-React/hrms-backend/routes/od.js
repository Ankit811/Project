import { Router } from 'express';
import OD from '../models/OD.js';
import Employee from '../models/Employee.js';
import Notification from '../models/Notification.js';
import Audit from '../models/Audit.js';
import auth from '../middleware/auth.js';
import role from '../middleware/role.js';
const router = Router();

// Submit OD (unchanged)
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

    const { dateOut, timeOut, dateIn, timeIn, purpose, placeUnitVisit } = req.body;

    // Validate required fields
    if (!dateOut || !timeOut || !dateIn || !purpose || !placeUnitVisit) {
      return res.status(400).json({ message: 'All required fields (Date Out, Time Out, Date In, Purpose, Place/Unit Visit) must be provided' });
    }

    // Validate date logic
    if (new Date(dateOut) > new Date(dateIn)) {
      return res.status(400).json({ message: 'Date Out must be before or equal to Date In' });
    }

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

    if (req.user.role === 'HOD' || req.user.role === 'Admin') {
      const ceo = await Employee.findOne({ loginType: 'CEO' });
      if (ceo) {
        await Notification.create({ userId: ceo.employeeId, message: `New OD request from ${user.name}` });
        if (global._io) global._io.to(ceo.employeeId).emit('notification', { message: `New OD request from ${user.name}` });
      }
    } else {
      const hod = await Employee.findOne({ department: user.department, loginType: 'HOD' });
      if (hod) {
        await Notification.create({ userId: hod.employeeId, message: `New OD request from ${user.name}` });
        if (global._io) global._io.to(hod.employeeId).emit('notification', { message: `New OD request from ${user.name}` });
      }
    }

    await Audit.create({ user: user.employeeId, action: 'Submit OD', details: 'Submitted OD request' });

    res.status(201).json(od);
  } catch (err) {
    console.error('OD submit error:', err.stack);
    res.status(500).json({ message: 'Server error', error: err.message });
  }
});

// Approve OD
router.put('/:id/approve', auth, role(['HOD', 'CEO', 'Admin']), async (req, res) => {
  try {
    const od = await OD.findById(req.params.id).populate('employee');
    if (!od) {
      return res.status(404).json({ message: 'OD request not found' });
    }

    const user = await Employee.findById(req.user.id);
    if (!user) {
      return res.status(404).json({ message: 'User not found' });
    }

    const { status } = req.body;
    const currentStage = req.user.role.toLowerCase();
    const validStatuses = req.user.role === 'Admin' ? ['Acknowledged'] : ['Approved', 'Rejected'];

    if (!validStatuses.includes(status)) {
      return res.status(400).json({ message: `Invalid status. Must be one of ${validStatuses.join(', ')}` });
    }

    if (od.status[currentStage] !== 'Pending') {
      return res.status(400).json({ message: `OD is not pending ${currentStage.toUpperCase()} approval` });
    }

    if (req.user.role === 'HOD' && user.department.toString() !== od.department.toString()) {
      return res.status(403).json({ message: 'Not authorized to approve ODs for this department' });
    }

    if (req.user.role === 'CEO' && od.status.hod !== 'Approved') {
      return res.status(400).json({ message: 'OD must be approved by HOD first' });
    }

    if (req.user.role === 'Admin' && od.status.ceo !== 'Approved') {
      return res.status(400).json({ message: 'OD must be approved by CEO first' });
    }

    od.status[currentStage] = status;

    if (status === 'Approved' && currentStage === 'hod') {
      od.status.ceo = 'Pending';
      const ceo = await Employee.findOne({ loginType: 'CEO' });
      if (ceo) {
        await Notification.create({
          userId: ceo.employeeId,
          message: `OD request from ${od.name} awaiting your approval`,
        });
        if (global._io) global._io.to(ceo.employeeId).emit('notification', { message: `OD request from ${od.name} awaiting your approval` });
      }
    }

    if (status === 'Approved' && currentStage === 'ceo') {
      od.status.admin = 'Pending';
      const admin = await Employee.findOne({ loginType: 'Admin' });
      if (admin) {
        await Notification.create({
          userId: admin.employeeId,
          message: `OD request from ${od.name} awaiting your acknowledgment`,
        });
        if (global._io) global._io.to(admin.employeeId).emit('notification', { message: `OD request from ${od.name} awaiting your acknowledgment` });
      }
    }

    if (status === 'Acknowledged' && currentStage === 'admin') {
      await Notification.create({
        userId: od.employee.employeeId,
        message: `Your OD request has been acknowledged by Admin`,
      });
      if (global._io) global._io.to(od.employee.employeeId).emit('notification', { message: `Your OD request has been acknowledged by Admin` });
    }

    if (status === 'Rejected') {
      await Notification.create({
        userId: od.employee.employeeId,
        message: `Your OD request was rejected by ${currentStage.toUpperCase()}`,
      });
      if (global._io) global._io.to(od.employee.employeeId).emit('notification', { message: `Your OD request was rejected by ${currentStage.toUpperCase()}` });
    }

    await od.save();

    await Audit.create({
      user: user.employeeId,
      action: `${status} OD`,
      details: `${status} OD request for ${od.name} by ${currentStage.toUpperCase()}`,
    });

    res.json({ message: `OD ${status.toLowerCase()} successfully`, od });
  } catch (err) {
    console.error('OD approval error:', err.stack);
    res.status(500).json({ message: 'Server error', error: err.message });
  }
});

// Get ODs (unchanged)
router.get('/', auth, async (req, res) => {
  try {
    const { status, fromDate, toDate, page = 1, limit = 10 } = req.query;
    const user = await Employee.findById(req.user.id);
    if (!user) {
      return res.status(404).json({ message: 'User not found' });
    }

    const query = {};
    if (status && status !== 'all') {
      query.$or = [
        { 'status.hod': status },
        { 'status.ceo': status },
        { 'status.admin': status },
      ];
    }
    if (fromDate) query.dateOut = { $gte: new Date(fromDate) };
    if (toDate) query.dateIn = { $lte: new Date(toDate) };

    if (req.user.role === 'Employee') {
      query.employee = req.user.id;
    } else if (req.user.role === 'HOD') {
      query.department = user.department;
    }

    const odRecords = await OD.find(query)
      .populate('employee', 'name designation')
      .populate('department', 'name')
      .skip((page - 1) * limit)
      .limit(parseInt(limit))
      .sort({ createdAt: -1 });

    const total = await OD.countDocuments(query);

    res.json({
      odRecords,
      total,
      page: parseInt(page),
      limit: parseInt(limit),
    });
  } catch (err) {
    console.error('Fetch ODs error:', err.stack);
    res.status(500).json({ message: 'Server error', error: err.message });
  }
});

export default router;

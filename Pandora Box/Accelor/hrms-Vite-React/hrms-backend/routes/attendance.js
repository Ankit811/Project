import { Router } from 'express';
import Attendance from '../models/Attendance.js';
import Employee from '../models/Employee.js';
import Leave from '../models/Leave.js';
import OD from '../models/OD.js';
import auth from '../middleware/auth.js';
import { utils, write } from 'xlsx';
const router = Router();

router.get('/', auth, async (req, res) => {
  try {
    let filter = {};

    if (req.user.loginType === 'Employee') {
      filter = { employeeId: req.user.employeeId };
    } else if (req.user.loginType === 'HOD') {
      const user = await Employee.findById(req.user.id).populate('department');
      const employees = await Employee.find({ department: user.department._id }).select('employeeId');
      filter = { employeeId: { $in: employees.map(e => e.employeeId) } };
    }

    if (req.query.employeeId) {
      filter.employeeId = req.query.employeeId;
    }
    if (req.query.departmentId) {
      const deptEmployees = await Employee.find({ department: req.query.departmentId }).select('employeeId');
      filter.employeeId = { $in: deptEmployees.map(e => e.employeeId) };
    }
    if (req.query.fromDate) {
      const fromDate = new Date(req.query.fromDate);
      fromDate.setHours(0, 0, 0, 0);
      const toDate = req.query.toDate ? new Date(req.query.toDate) : new Date(fromDate);
      toDate.setHours(23, 59, 59, 999);
      filter.logDate = { $gte: fromDate, $lte: toDate };
    }

    const attendance = await Attendance.find(filter).lean();
    console.log(`Fetched ${attendance.length} attendance records for filter:`, filter);
    res.json(attendance);
  } catch (err) {
    console.error('Error fetching attendance:', err);
    res.status(500).json({ message: 'Server error', error: err.message });
  }
});

router.get('/download', auth, async (req, res) => {
  try {
    let filter = {};

    if (req.user.loginType === 'Employee') {
      filter = { employeeId: req.user.employeeId };
    } else if (req.user.loginType === 'HOD') {
      const user = await Employee.findById(req.user.id).populate('department');
      const employees = await Employee.find({ department: user.department._id }).select('employeeId');
      filter = { employeeId: { $in: employees.map(e => e.employeeId) } };
    }

    if (req.query.employeeId) {
      filter.employeeId = req.query.employeeId;
    }
    if (req.query.departmentId) {
      const deptEmployees = await Employee.find({ department: req.query.departmentId }).select('employeeId');
      filter.employeeId = { $in: deptEmployees.map(e => e.employeeId) };
    }
    if (req.query.fromDate) {
      const fromDate = new Date(req.query.fromDate);
      fromDate.setHours(0, 0, 0, 0);
      const toDate = req.query.toDate ? new Date(req.query.toDate) : new Date(fromDate);
      toDate.setHours(23, 59, 59, 999);
      filter.logDate = { $gte: fromDate, $lte: toDate };
    }
    if (req.query.status) {
      filter.status = req.query.status;
    }

    const attendance = await Attendance.find(filter).lean();
    console.log(`Fetched ${attendance.length} attendance records for download with filter:`, filter);

    // Fetch employee details for department information
    const employeeIds = [...new Set(attendance.map(record => record.employeeId))];
    const employees = await Employee.find({ employeeId: { $in: employeeIds } })
      .populate('department')
      .lean();
    const employeeMap = employees.reduce((map, emp) => {
      map[emp.employeeId] = emp.department ? emp.department.name : 'Unknown';
      return map;
    }, {});

    // Fetch approved leaves
    const leaves = await Leave.find({
      $or: [
        { 'fullDay.from': { $gte: filter.logDate?.$gte, $lte: filter.logDate?.$lte } },
        { 'halfDay.date': { $gte: filter.logDate?.$gte, $lte: filter.logDate?.$lte } },
      ],
      'status.ceo': 'Approved',
    }).lean();

    // Fetch approved ODs
    const ods = await OD.find({
      dateOut: { $lte: filter.logDate?.$lte },
      dateIn: { $gte: filter.logDate?.$gte },
      'status.ceo': 'Approved',
    }).lean();

    // Create leave map
    const leaveMap = {};
    leaves.forEach(leave => {
      const dateKey = leave.halfDay?.date
        ? new Date(leave.halfDay.date).toISOString().split('T')[0]
        : new Date(leave.fullDay.from).toISOString().split('T')[0];
      const employeeKey = leave.employeeId;
      if (!leaveMap[employeeKey]) leaveMap[employeeKey] = {};
      leaveMap[employeeKey][dateKey] = leave.halfDay ? `(L) ${leave.halfDay.session === 'forenoon' ? 'First Half' : 'Second Half'}` : '(L)';
    });

    // Create OD map
    const odMap = {};
    ods.forEach(od => {
      const startDate = new Date(od.dateOut);
      const endDate = new Date(od.dateIn);
      const employeeKey = od.employeeId;
      if (!odMap[employeeKey]) odMap[employeeKey] = {};
      for (let d = new Date(startDate); d <= endDate; d.setDate(d.getDate() + 1)) {
        const dateKey = d.toISOString().split('T')[0];
        odMap[employeeKey][dateKey] = '(OD)';
      }
    });

    const data = attendance.map((record, index) => {
      const dateStr = new Date(record.logDate).toISOString().split('T')[0];
      const leaveStatus = leaveMap[record.employeeId]?.[dateStr] || '';
      const odStatus = odMap[record.employeeId]?.[dateStr] || '';
      const status = leaveStatus || odStatus || (record.status === 'Absent' ? '(A)' : '');
      return {
        'Serial Number': index + 1,
        'Name of Employee': record.name,
        'Department': employeeMap[record.employeeId] || 'Unknown',
        'Date': `${dateStr} ${status}`,
        'Time In': record.timeIn || '-',
        'Time Out': record.timeOut || '-',
        'Status': record.status + (record.halfDay ? ` (${record.halfDay})` : ''),
        'OT': record.ot ? `${Math.floor(record.ot / 60)}:${(record.ot % 60).toString().padStart(2, '0')}` : '00:00',
      };
    });

    const ws = utils.json_to_sheet(data);
    const wb = utils.book_new();
    utils.book_append_sheet(wb, ws, 'Attendance');
    const buffer = write(wb, { type: 'buffer', bookType: 'xlsx' });

    res.setHeader('Content-Disposition', `attachment; filename=attendance_${req.query.status}_${req.query.fromDate}.xlsx`);
    res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
    res.send(buffer);
  } catch (err) {
    console.error('Error generating Excel:', err);
    res.status(500).json({ message: 'Server error', error: err.message });
  }
});

export default router;

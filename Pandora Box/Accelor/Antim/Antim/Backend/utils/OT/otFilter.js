import Employee from '../../models/Employee.js';
import Attendance from '../../models/Attendance.js';

async function buildOTFilter(req) {
  let filter = {};
  const { status, fromDate, toDate } = req.query;

  if (req.user.role === 'Employee') {
    filter = { employeeId: req.user.employeeId };
  } else if (req.user.role === 'HOD') {
    const hod = await Employee.findEmployee({ employeeId: req.user.employeeId }).populate('department');
    if (!hod || !hod.department || !hod.department._id) {
      throw new Error('HOD has no valid department assigned');
    }
    filter = { department: hod.department._id };
  } else if (req.user.role === 'Admin' || req.user.role === 'CEO') {
    filter = {};
  } else {
    throw new Error('Unauthorized role');
  }

  if (status && status !== 'all') {
    filter.$or = [
      { 'status.hod': status },
      { 'status.admin': status },
      { 'status.ceo': status },
    ];
  }

  if (fromDate || toDate) {
    filter.date = {};
    if (fromDate) filter.date.$gte = new Date(fromDate);
    if (toDate) {
      const toDateEnd = new Date(toDate);
      toDateEnd.setHours(23, 59, 59, 999);
      filter.date.$lte = toDateEnd;
    }
  }

  return filter;
}

async function getUnclaimedOTRecords(user) {
  const unclaimedOTRecords = await Attendance.find({
    employeeId: user.employeeId,
    ot: { $gt: 0 },
    logDate: { $gte: new Date().setDate(new Date().getDate() - 7) },
  }).lean();

  return unclaimedOTRecords.map(record => {
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

export { buildOTFilter, getUnclaimedOTRecords };
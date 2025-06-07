import Employee from '../../models/Employee.js';

async function buildLeaveFilter(req) {
  let filter = {};
  const { leaveType, status, fromDate, toDate } = req.query;

  if (req.user.role === 'Employee') {
    filter = { employeeId: req.user.employeeId };
  } else if (req.user.role === 'HOD') {
    const hod = await Employee.findEmployee({ employeeId: req.user.employeeId }).populate('department');
    if (!hod || !hod.department || !hod.department._id) {
      throw new Error('HOD has no valid department assigned');
    }
    filter = { department: hod.department._id };
    if (status && status !== 'all') {
      filter.$or = [
        { 'status.hod': status },
        { 'status.ceo': status },
        { 'status.admin': status }
      ];
    }
  } else if (req.user.role === 'Admin' || req.user.role === 'CEO') {
    if (status && status !== 'all') {
      filter.$or = [
        { 'status.hod': status },
        { 'status.ceo': status },
        { 'status.admin': status }
      ];
    }
  } else {
    throw new Error('Unauthorized role');
  }

  if (leaveType && leaveType !== 'all') {
    filter.leaveType = leaveType;
  }

  if (fromDate || toDate) {
    const dateConditions = [];

    if (fromDate) {
      dateConditions.push({
        $or: [
          { 'fullDay.from': { $gte: new Date(fromDate) } },
          { 'halfDay.date': { $gte: new Date(fromDate) } }
        ]
      });
    }

    if (toDate) {
      const toDateEnd = new Date(toDate);
      toDateEnd.setHours(23, 59, 59, 999);
      dateConditions.push({
        $or: [
          { 'fullDay.to': { $lte: toDateEnd } },
          { 'halfDay.date': { $lte: toDateEnd } }
        ]
      });
    }

    if (dateConditions.length > 0) {
      filter.$and = dateConditions;
    }
  }

  return filter;
}

export { buildLeaveFilter };
import Employee from '../../models/Employee.js';

async function buildODFilter(req) {
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

  if (fromDate || toDate) {
    const dateConditions = [];
    if (fromDate) {
      dateConditions.push({ dateOut: { $gte: new Date(fromDate) } });
    }
    if (toDate) {
      const toDateEnd = new Date(toDate);
      toDateEnd.setHours(23, 59, 59, 999);
      dateConditions.push({ dateIn: { $lte: toDateEnd } });
    }
    if (dateConditions.length > 0) {
      filter.$and = dateConditions;
    }
  }

  return filter;
}

export { buildODFilter };
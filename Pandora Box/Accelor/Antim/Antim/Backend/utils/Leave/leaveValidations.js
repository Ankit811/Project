import Leave from '../../models/Leave.js';

async function validateLeaveRequest(req, user) {
  if (!user.designation) {
    throw new Error('Employee designation is required');
  }
  if (!user.department) {
    throw new Error('Employee department is required');
  }

  const currentYear = new Date().getFullYear();
  const leaveDays = req.body.halfDay ? 0.5 :
    (req.body.fullDay?.from && req.body.fullDay?.to
      ? ((new Date(req.body.fullDay.to) - new Date(req.body.fullDay.from)) / (1000 * 60 * 60 * 24)) + 1
      : 0);
  if (leaveDays === 0 && !req.body.halfDay) {
    throw new Error('Invalid leave dates provided');
  }

  let leaveStart, leaveEnd;
  if (req.body.halfDay?.date) {
    leaveStart = new Date(req.body.halfDay.date);
    leaveEnd = new Date(req.body.halfDay.date);
  } else if (req.body.fullDay?.from && req.body.fullDay?.to) {
    leaveStart = new Date(req.body.fullDay.from);
    leaveEnd = new Date(req.body.fullDay.to);
    if (leaveStart > leaveEnd) {
      throw new Error('Leave start date cannot be after end date');
    }
  } else {
    throw new Error('Either halfDay or fullDay dates are required');
  }

  const leaveType = req.body.leaveType;
  const isConfirmed = user.employeeType === 'Confirmed';
  const joinDate = new Date(user.dateOfJoining);
  const yearsOfService = (new Date() - joinDate) / (1000 * 60 * 60 * 24 * 365);

  switch (leaveType) {
    case 'Casual':
      const canTakeCasualLeave = await user.checkConsecutivePaidLeaves(leaveStart, leaveEnd);
      if (!canTakeCasualLeave) {
        throw new Error('Cannot take more than 3 consecutive paid leave days.');
      }
      if (user.paidLeaves < leaveDays) {
        throw new Error('Insufficient Casual leave balance.');
      }
      break;
    case 'Medical':
      if (!isConfirmed) throw new Error('Medical leave is only for confirmed employees.');
      if (![3, 4].includes(leaveDays)) throw new Error('Medical leave must be either 3 or 4 days.');
      if (user.medicalLeaves < leaveDays) throw new Error('Medical leave already used or insufficient balance for this year.');
      const medicalLeavesThisYear = await Leave.find({
        employeeId: user.employeeId,
        leaveType: 'Medical',
        'status.admin': 'Approved',
        $or: [
          { 'fullDay.from': { $gte: new Date(currentYear, 0, 1) } },
          { 'halfDay.date': { $gte: new Date(currentYear, 0, 1) } },
        ],
      });
      if (medicalLeavesThisYear.length > 0) {
        throw new Error('Medical leave can only be used once per year.');
      }
      break;
    case 'Maternity':
      if (!isConfirmed || user.gender !== 'Female') throw new Error('Maternity leave is only for confirmed female employees.');
      if (yearsOfService < 1) throw new Error('Must have completed one year of service.');
      if (leaveDays !== 90) throw new Error('Maternity leave must be 90 days.');
      if (user.maternityClaims >= 2) throw new Error('Maternity leave can only be availed twice during service.');
      if (leaveDays > 3) {
        throw new Error('Cannot take more than 3 consecutive paid leave days.');
      }
      break;
    case 'Paternity':
      if (!isConfirmed || user.gender !== 'Male') throw new Error('Paternity leave is only for confirmed male employees.');
      if (yearsOfService < 1) throw new Error('Must have completed one year of service.');
      if (leaveDays !== 7) throw new Error('Paternity leave must be 7 days.');
      if (user.paternityClaims >= 2) throw new Error('Paternity leave can only be availed twice during service.');
      if (leaveDays > 3) {
        throw new Error('Cannot take more than 3 consecutive paid leave days.');
      }
      break;
    case 'Restricted Holidays':
      if (leaveDays !== 1) throw new Error('Restricted Holiday must be 1 day.');
      if (user.restrictedHolidays < 1) throw new Error('Restricted Holiday already used for this year.');
      const canTakeRestrictedLeave = await user.checkConsecutivePaidLeaves(leaveStart, leaveEnd);
      if (!canTakeRestrictedLeave) {
        throw new Error('Cannot take more than 3 consecutive paid leave days.');
      }
      if (!req.body.restrictedHoliday) throw new Error('Restricted holiday must be selected.');
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
          { 'status.admin': { $in: ['Pending', 'Approved'] } },
        ],
      });
      if (existingRestrictedLeave) {
        throw new Error('A Restricted Holiday request already exists for this year.');
      }
      break;
    case 'Compensatory':
      if (!req.body.compensatoryEntryId || !req.body.projectDetails) {
        throw new Error('Compensatory entry ID and project details are required');
      }
      const entry = user.compensatoryAvailable.find(e => e._id.toString() === req.body.compensatoryEntryId && e.status === 'Available');
      if (!entry) {
        throw new Error('Invalid or unavailable compensatory leave entry');
      }
      const hoursNeeded = leaveDays === 0.5 ? 4 : 8;
      if (entry.hours !== hoursNeeded) {
        throw new Error(`Selected entry (${entry.hours} hours) does not match leave duration (${leaveDays === 0.5 ? 'Half Day (4 hours)' : 'Full Day (8 hours)'})`);
      }
      break;
    case 'Leave Without Pay(LWP)':
      break;
    default:
      throw new Error('Invalid leave type.');
  }

  return { leaveDays, leaveStart, leaveEnd };
}

export { validateLeaveRequest };
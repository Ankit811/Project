import Employee from '../../models/Employee.js';
import Attendance from '../../models/Attendance.js';

async function validateOTRequest(req, employee) {
  if (!employee.department) {
    throw new Error('Employee department is required');
  }

  const { date, hours, projectDetails, claimType } = req.body;
  if (!date || !hours || !projectDetails) {
    throw new Error('Date, hours, and project details are required');
  }

  const otDate = new Date(date);
  if (isNaN(otDate.getTime())) {
    throw new Error('Invalid date');
  }
  if (hours <= 0 || hours > 24) {
    throw new Error('Hours must be between 0 and 24');
  }
  if (hours < 1) {
    throw new Error('Hours must be at least 1');
  }

  const normalizeDate = (d) => {
    const date = new Date(d);
    return new Date(date.getFullYear(), date.getMonth(), date.getDate());
  };
  const normalizedOtDate = normalizeDate(otDate);
  const now = new Date();
  const claimDeadline = new Date(normalizedOtDate);
  claimDeadline.setDate(claimDeadline.getDate() + 1);
  claimDeadline.setHours(23, 59, 59, 999);

  if (now > claimDeadline) {
    throw new Error('OT claim must be submitted by 11:59 PM the next day');
  }

  const eligibleDepartments = ['Production', 'Testing', 'AMETL', 'Admin'];
  const isEligible = eligibleDepartments
    .map(d => d.toLowerCase())
    .includes(employee.department?.name?.toLowerCase());
  let attendanceRecord;
  let compensatoryHours = 0;
  let paymentAmount = 0;

  if (isEligible) {
    attendanceRecord = await Attendance.findOne({
      employeeId: employee.employeeId,
      logDate: { $gte: normalizedOtDate, $lte: normalizedOtDate },
      ot: { $gte: 60 }
    });
    if (!attendanceRecord) {
      throw new Error('No OT recorded for this date');
    }
    const recordedOtHours = attendanceRecord.ot / 60;
    if (hours > recordedOtHours) {
      throw new Error(`Claimed hours (${hours}) exceed recorded OT (${recordedOtHours.toFixed(1)})`);
    }
    if (recordedOtHours > 4 && !claimType) {
      throw new Error('Claim type (Full/Partial) is required for OT > 4 hours');
    }
    if (claimType === 'Partial' && hours !== recordedOtHours - (recordedOtHours >= 8 ? 8 : 4)) {
      throw new Error(`Partial claim must be for ${recordedOtHours - (recordedOtHours >= 8 ? 8 : 4)} hours`);
    }
    if (!claimType || claimType === 'Full') {
      paymentAmount = hours * 500 * 1.5;
    } else if (claimType === 'Partial') {
      paymentAmount = (hours - (attendanceRecord.ot >= 8 * 60 ? 8 : 4)) * 500 * 1.5;
      compensatoryHours = attendanceRecord.ot >= 8 * 60 ? 8 : 4;
    }
  } else {
    if (otDate.getDay() !== 0) {
      throw new Error('OT claims for non-eligible departments are only allowed for Sundays');
    }
    attendanceRecord = await Attendance.findOne({
      employeeId: employee.employeeId,
      logDate: { $gte: normalizedOtDate, $lte: normalizedOtDate },
    });
    if (!attendanceRecord) {
      throw new Error('No attendance recorded for this date');
    }
    const recordedOtHours = attendanceRecord.ot / 60;
    if (hours > recordedOtHours) {
      throw new Error(`Claimed hours (${hours}) exceed recorded OT (${recordedOtHours.toFixed(1)})`);
    }
    if (hours < 4) {
      throw new Error('Compensatory leave requires at least 4 hours');
    }
    compensatoryHours = hours >= 4 && hours < 8 ? 4 : hours >= 8 ? 8 : 0;
  }

  return { date: otDate, hours, projectDetails, claimType: isEligible ? (claimType || 'Full') : null, compensatoryHours, paymentAmount };
}

export { validateOTRequest };
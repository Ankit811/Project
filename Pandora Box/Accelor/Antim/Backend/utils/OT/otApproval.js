import OTClaim from '../../models/OTClaim.js';
import Employee from '../../models/Employee.js';
import Attendance from '../../models/Attendance.js';

async function approveOT(otId, user, status) {
  const otClaim = await OTClaim.findById(otId);
  if (!otClaim) throw new Error('OT claim not found');

  const employee = await Employee.findEmployee({ employeeId: otClaim.employeeId }).populate('department');
  if (!employee) throw new Error('Employee not found');

  let nextStage = '';
  let approverMessage = '';

  if (user.role === 'HOD' && otClaim.status.hod === 'Pending') {
    otClaim.status.hod = status;
    if (status === 'Approved') {
      nextStage = 'ceo';
      approverMessage = `OT claim from ${otClaim.name} approved by HOD`;
    } else {
      approverMessage = `Your OT claim for ${new Date(otClaim.date).toDateString()} was rejected by HOD`;
    }
  } else if (user.role === 'CEO' && otClaim.status.hod === 'Approved' && otClaim.status.ceo === 'Pending') {
    otClaim.status.ceo = status;
    if (status === 'Approved') {
      nextStage = employee.loginType === 'Admin' ? '' : 'admin';
      approverMessage = `OT claim from ${otClaim.name} approved by CEO`;
    } else {
      approverMessage = `Your OT claim for ${new Date(otClaim.date).toDateString()} was rejected by CEO`;
    }
  } else if (user.role === 'Admin' && otClaim.status.ceo === 'Approved' && otClaim.status.admin === 'Pending') {
    otClaim.status.admin = status;
    approverMessage = `Your OT claim for ${new Date(otClaim.date).toDateString()} was ${status.toLowerCase()} by Admin`;
    if (status === 'Approved') {
      const eligibleDepartments = ['Production', 'Testing', 'AMETL', 'Admin'];
      const isEligible = eligibleDepartments.includes(employee.department?.name);
      if (isEligible) {
        const attendance = await Attendance.findOne({
          employeeId: employee.employeeId,
          logDate: {
            $gte: new Date(otClaim.date).setHours(0, 0, 0, 0),
            $lte: new Date(otClaim.date).setHours(23, 59, 59, 999),
          },
        });
        if (attendance) {
          attendance.ot = 0;
          await attendance.save();
        }
        if (otClaim.compensatoryHours > 0) {
          await employee.addCompensatoryLeave(otClaim.date, otClaim.compensatoryHours);
        }
      } else {
        if (otClaim.compensatoryHours > 0) {
          await employee.addCompensatoryLeave(otClaim.date, otClaim.compensatoryHours);
        }
      }
    }
  } else {
    throw new Error('Not authorized to approve this OT claim');
  }

  await otClaim.save();
  return { otClaim, nextStage, approverMessage };
}

export { approveOT };
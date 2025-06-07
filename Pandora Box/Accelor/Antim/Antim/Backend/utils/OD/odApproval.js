import OD from '../../models/OD.js';
import Employee from '../../models/Employee.js';

async function approveOD(odId, user, status) {
  const od = await OD.findById(odId);
  if (!od) throw new Error('OD request not found');

  const employee = await Employee.findEmployee({ employeeId: od.employeeId });
  if (!employee) throw new Error('Employee not found');

  let nextStage = '';
  let approverMessage = '';

  if (user.role === 'HOD' && od.status.hod === 'Pending') {
    od.status.hod = status;
    if (status === 'Approved') {
      nextStage = 'ceo';
      approverMessage = `OD request from ${od.name} approved by HOD`;
    } else {
      approverMessage = `Your OD request was rejected by HOD`;
    }
  } else if (user.role === 'CEO' && od.status.hod === 'Approved' && od.status.ceo === 'Pending') {
    od.status.ceo = status;
    if (status === 'Approved') {
      nextStage = employee.loginType === 'Admin' ? '' : 'admin';
      approverMessage = `OD request from ${od.name} approved by CEO`;
    } else {
      approverMessage = `Your OD request was rejected by CEO`;
    }
  } else if (user.role === 'Admin' && od.status.ceo === 'Approved' && od.status.admin === 'Pending') {
    od.status.admin = status;
    approverMessage = `Your OD request was ${status.toLowerCase()} by Admin`;
  } else {
    throw new Error('Not authorized to approve this OD request');
  }

  await od.save();
  return { od, nextStage, approverMessage };
}

export { approveOD };

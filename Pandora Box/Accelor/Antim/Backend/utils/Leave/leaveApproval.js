import Leave from '../../models/Leave.js';
import Employee from '../../models/Employee.js';

async function approveLeave(leaveId, user, status) {
  const leave = await Leave.findById(leaveId);
  if (!leave) throw new Error('Leave not found');

  const employee = await Employee.findEmployee({ employeeId: leave.employeeId });
  if (!employee) throw new Error('Employee not found');

  let nextStage = '';
  let approverMessage = '';

  if (user.role === 'HOD' && leave.status.hod === 'Pending') {
    leave.status.hod = status;
    if (status === 'Approved') {
      nextStage = 'ceo';
      approverMessage = `Leave request from ${leave.name} approved by HOD`;
    } else {
      approverMessage = `Your leave request was rejected by HOD`;
    }
  } else if (user.role === 'CEO' && leave.status.hod === 'Approved' && leave.status.ceo === 'Pending') {
    leave.status.ceo = status;
    if (status === 'Approved') {
      nextStage = employee.loginType === 'Admin' ? '' : 'admin';
      approverMessage = `Leave request from ${leave.name} approved by CEO`;
    } else {
      approverMessage = `Your leave request was rejected by CEO`;
    }
  } else if (user.role === 'Admin' && leave.status.ceo === 'Approved' && leave.status.admin === 'Pending') {
    leave.status.admin = status;
    approverMessage = `Your leave request was ${status.toLowerCase()} by Admin`;
    if (status === 'Approved') {
      let leaveStart, leaveEnd;
      if (leave.halfDay?.date) {
        leaveStart = new Date(leave.halfDay.date);
        leaveEnd = leaveStart;
      } else if (leave.fullDay?.from && leave.fullDay?.to) {
        leaveStart = new Date(leave.fullDay.from);
        leaveEnd = new Date(leave.fullDay.to);
      }
      if (leaveStart && leaveEnd) {
        const leaveDays = leaveStart.getTime() === leaveEnd.getTime() ? 0.5 : ((leaveEnd - leaveStart) / (1000 * 60 * 60 * 24)) + 1;
        switch (leave.leaveType) {
          case 'Casual':
            if (employee.paidLeaves >= leaveDays) {
              await employee.deductPaidLeaves(leaveStart, leaveEnd);
            } else {
              throw new Error('Insufficient Casual leave balance.');
            }
            break;
          case 'Medical':
            if (employee.medicalLeaves >= leaveDays) {
              await employee.deductMedicalLeaves(leaveDays);
            } else {
              throw new Error('Insufficient Medical leave balance.');
            }
            break;
          case 'Maternity':
            if (employee.maternityClaims < 2) {
              await employee.recordMaternityClaim();
            } else {
              throw new Error('Maternity leave limit reached.');
            }
            break;
          case 'Paternity':
            if (employee.paternityClaims < 2) {
              await employee.recordPaternityClaim();
            } else {
              throw new Error('Paternity leave limit reached.');
            }
            break;
          case 'Compensatory':
            if (!leave.compensatoryEntryId) {
              throw new Error('Compensatory entry ID is required');
            }
            await employee.deductCompensatoryLeaves(leave.compensatoryEntryId);
            break;
          case 'Restricted Holidays':
            if (employee.restrictedHolidays >= 1) {
              await employee.deductRestrictedHolidays();
            } else {
              throw new Error('Restricted Holiday already used.');
            }
            break;
          case 'Leave Without Pay(LWP)':
            await employee.recordUnpaidLeaves(leaveStart, leaveEnd);
            break;
        }
      }
    }
  } else {
    throw new Error('Not authorized to approve this leave');
  }

  await leave.save();
  return { leave, nextStage, approverMessage };
}

export { approveLeave };
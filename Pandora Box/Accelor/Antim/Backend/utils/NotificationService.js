import Notification from '../models/Notification.js';
import Employee from '../models/Employee.js';

async function sendNotification(userId, message) {
  await Notification.create({ userId, message });
  if (global._io) global._io.to(userId).emit('notification', { message });
}

async function notifySubmission(user, request, requestType = 'Leave') {
  if (user.role === 'HOD' || user.role === 'Admin') {
    const ceo = await Employee.findEmployee({ loginType: 'CEO' });
    if (ceo) {
      await sendNotification(ceo.employeeId, `New ${requestType} request from ${user.name}`);
    }
  } else {
    const hod = await Employee.findEmployee({ department: user.department._id || user.department, loginType: 'HOD' });
    if (hod) {
      await sendNotification(hod.employeeId, `New ${requestType} request from ${user.name}`);
    }
  }
}

async function notifyApproval(request, user, nextStage, approverMessage, requestType = 'Leave') {
  await sendNotification(user.employeeId, approverMessage);

  if (nextStage) {
    let nextApprover = null;
    if (nextStage === 'ceo') {
      nextApprover = await Employee.findEmployee({ loginType: 'CEO' });
    } else if (nextStage === 'admin') {
      nextApprover = await Employee.findEmployee({ loginType: 'Admin' });
    }
    if (nextApprover) {
      await sendNotification(nextApprover.employeeId, `New ${requestType} request from ${request.name} awaits your approval`);
    }
  }
}

export { notifySubmission, notifyApproval };
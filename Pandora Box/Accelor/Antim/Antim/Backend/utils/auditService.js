// services/auditService.js
import Audit from '../models/Audit.js';

const logEmployeeAction = async (action, employeeId, performedBy, details = {}) => {
  try {
    await Audit.create({
      action,
      targetId: employeeId,
      performedBy,
      details
    })
  } catch (error) {
    console.error('Audit logging failed:', error);
  }
};

export  { logEmployeeAction };

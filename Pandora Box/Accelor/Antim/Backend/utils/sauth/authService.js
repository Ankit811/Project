// services/authorizationService.js
import Employee from '../../models/Employee.js';

// Use destructuring to get methods (though this is less common)
const { findById, find } = Employee;

const getAttendanceFilter = async (user) => {
  let filter = {};
  
  if (user.loginType === 'Employee') {
    filter = { employeeId: user.employeeId };
  } else if (user.loginType === 'HOD') {
    const userDoc = await findById(user.id).populate('department');
    const employees = await find({ department: userDoc.department._id }).select('employeeId');
    filter = { employeeId: { $in: employees.map(e => e.employeeId) } };
  }
  // Admin gets no additional filter
  
  return filter;
};

const checkEmployeeUpdatePermission = (user, employee) => {
  const isAdmin = user.role === 'Admin';
  const isSelf = user.employeeId === employee.employeeId;
  return isAdmin || isSelf;
};

const checkSectionLockPermissions = (employee, updates, files, userRole) => {
  if (userRole === 'Admin') {
    return { canUpdate: true, unauthorizedFields: [] };
  }

  const unauthorizedFields = [];
  const fieldGroups = {
    basicInfo: ['employeeId', 'userId', 'email', 'password', 'name', 'dateOfBirth'],
    position: ['designation', 'location', 'department'],
    statutory: ['panNumber', 'pfNumber', 'uanNumber', 'esiNumber'],
    documents: ['tenthTwelfthDocs', 'graduationDocs', 'postgraduationDocs'],
    payment: ['paymentType', 'bankName', 'bankBranch', 'accountNumber', 'ifscCode']
  };

  Object.entries(fieldGroups).forEach(([section, fields]) => {
    const lockField = `${section}Locked`;
    if (employee[lockField] && fields.some(field => updates[field] || files[field])) {
      unauthorizedFields.push(section);
    }
  });

  return { 
    canUpdate: unauthorizedFields.length === 0, 
    unauthorizedFields 
  };
};

export  { 
  getAttendanceFilter, 
  checkEmployeeUpdatePermission, 
  checkSectionLockPermissions 
};

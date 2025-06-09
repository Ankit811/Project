// utils/validationUtils.js
// validators/employeeValidator.js
const validateEmployeeData = (data) => {
    const errors = [];
    
    // Required field validation
    const requiredFields = ['employeeId', 'userId', 'email', 'name', 'fatherName'];
    requiredFields.forEach(field => {
      if (!data[field] || data[field].toString().trim() === '') {
        errors.push(`${field} is required`);
      }
    });
    
    // Format validation
    if (data.aadharNo && !/^\d{12}$/.test(data.aadharNo)) {
      errors.push('Aadhar number must be 12 digits');
    }
    
    if (data.mobileNo && !/^\d{10}$/.test(data.mobileNo)) {
      errors.push('Mobile number must be 10 digits');
    }
    
    return { isValid: errors.length === 0, errors };
  };
  
  const validateConditionalFields = (data) => {
    const errors = [];
    
    if (data.maritalStatus === 'Married' && !data.spouseName) {
      errors.push('Spouse name is required for married employees');
    }
    
    if (data.paymentType === 'Bank Transfer') {
      if (!data.bankName) errors.push('Bank name is required for bank transfer');
      if (!data.accountNumber) errors.push('Account number is required for bank transfer');
      if (!data.ifscCode) errors.push('IFSC code is required for bank transfer');
    }
    
    return { isValid: errors.length === 0, errors };
  };
  
  const validateField = (field, value) => {
    const patterns = {
      aadhar: /^\d{12}$/,
      mobile: /^\d{10}$/,
      email: /^[^\s@]+@[^\s@]+\.[^\s@]+$/,
      pan: /^[A-Z]{5}[0-9]{4}[A-Z]$/,
      pf: /^\d{18}$/,
      uan: /^\d{12}$/,
      esi: /^\d{12}$/,
      bloodGroup: /^(A|B|AB|O)[+-]$/,
    };
  
    const messages = {
      aadhar: 'Aadhar Number must be exactly 12 digits.',
      mobile: 'Mobile Number must be exactly 10 digits.',
      email: 'Invalid email format.',
      pan: 'PAN must be 10 characters: 5 letters, 4 digits, 1 letter.',
      pf: 'PF Number must be 18 digits.',
      uan: 'UAN Number must be 12 digits.',
      esi: 'ESI Number must be 12 digits.',
      bloodGroup: 'Invalid blood group.',
    };
  
    const regex = patterns[field];
    if (!regex) {
      return { isValid: true }; // no validation needed
    }
  
    const isValid = regex.test(value);
    return {
      isValid,
      message: isValid ? '' : messages[field],
    };
  };
  
  
  export  { validateEmployeeData, validateConditionalFields, validateField };
  
  
  
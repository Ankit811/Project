function addMonths(date, months) {
    const d = new Date(date);
    d.setMonth(d.getMonth() + months);
    return d;
  }
  
  function isNewYearOrLater(lastDate, currentYear) {
    return !lastDate || lastDate.getFullYear() < currentYear;
  }
  
  function isNewMonthOrLater(lastDate, currentYear, currentMonth) {
    return (
      !lastDate ||
      lastDate.getFullYear() < currentYear ||
      (lastDate.getFullYear() === currentYear && lastDate.getMonth() < currentMonth)
    );
  }
  
export default function handleLeaveReset(employee) {
    const today = new Date();
    const currentYear = today.getUTCFullYear();
    const currentMonth = today.getUTCMonth();
  
    if (employee.isNew) {
      if (employee.employeeType === 'Confirmed') {
        const joinDate = new Date(employee.dateOfJoining);
        if (isNaN(joinDate)) {
          throw new Error('Invalid dateOfJoining for confirmed employee');
        }
        const joinMonth = joinDate.getUTCMonth();
        employee.paidLeaves = 12 - joinMonth;
        employee.lastLeaveReset = new Date(Date.UTC(currentYear, 0, 1));
      } else if (['Intern', 'Contractual', 'Probation'].includes(employee.employeeType)) {
        employee.paidLeaves = 1;
        employee.lastMonthlyReset = new Date(Date.UTC(currentYear, currentMonth, 1));
      }
      employee.medicalLeaves = 7;
      employee.restrictedHolidays = 1;
      employee.lastMedicalReset = new Date(Date.UTC(currentYear, 0, 1));
      employee.lastRestrictedHolidayReset = new Date(Date.UTC(currentYear, 0, 1));
      employee.maternityClaims = 0;
      employee.paternityClaims = 0;
      employee.compensatoryLeaves = 0;
      employee.lastCompensatoryReset = new Date(Date.UTC(currentYear, currentMonth, 1));
    }
  
    // Compensatory leave expiration (6 months)
    const lastCompReset = employee.lastCompensatoryReset ? new Date(employee.lastCompensatoryReset) : null;
    if (lastCompReset) {
      const sixMonthsLater = addMonths(lastCompReset, 6);
      if (today >= sixMonthsLater) {
        employee.compensatoryLeaves = 0;
        employee.lastCompensatoryReset = new Date(Date.UTC(currentYear, currentMonth, 1));
      }
    }
  
    // Casual leave resets
    if (employee.employeeType === 'Confirmed') {
      const lastReset = employee.lastLeaveReset ? new Date(employee.lastLeaveReset) : null;
      if (isNewYearOrLater(lastReset, currentYear)) {
        employee.paidLeaves = 12;
        employee.lastLeaveReset = new Date(Date.UTC(currentYear, 0, 1));
      }
    } else if (['Intern', 'Contractual', 'Probation'].includes(employee.employeeType)) {
      const lastMonthlyReset = employee.lastMonthlyReset ? new Date(employee.lastMonthlyReset) : null;
      if (isNewMonthOrLater(lastMonthlyReset, currentYear, currentMonth)) {
        employee.paidLeaves = (employee.paidLeaves || 0) + 1;
        employee.lastMonthlyReset = new Date(Date.UTC(currentYear, currentMonth, 1));
      }
    }
  
    // Medical leave reset
    const lastMedReset = employee.lastMedicalReset ? new Date(employee.lastMedicalReset) : null;
    if (isNewYearOrLater(lastMedReset, currentYear)) {
      employee.medicalLeaves = 7;
      employee.lastMedicalReset = new Date(Date.UTC(currentYear, 0, 1));
    }
  
    // Restricted Holiday reset
    const lastResReset = employee.lastRestrictedHolidayReset ? new Date(employee.lastRestrictedHolidayReset) : null;
    if (isNewYearOrLater(lastResReset, currentYear)) {
      employee.restrictedHolidays = 1;
      employee.lastRestrictedHolidayReset = new Date(Date.UTC(currentYear, 0, 1));
    }
  }
  
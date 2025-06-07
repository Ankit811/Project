const ELIGIBLE_DEPARTMENTS = ['Production', 'Store', 'AMETL', 'Admin'];

export default function isEligibleForOT(department) {
    if (!department || typeof department !== 'string') {
        return false; // Invalid input
    }
    
    const normalizedDepartment = department.trim();
    return ELIGIBLE_DEPARTMENTS.includes(normalizedDepartment);
    }
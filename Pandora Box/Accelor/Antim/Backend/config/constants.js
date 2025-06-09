// config/constants.js

// Total minutes required for a full workday (e.g. 8 hours 30 minutes)
export const WORK_DURATION_THRESHOLD = 510;

// Minimum minutes to not be considered absent (e.g. 4 hours)
export const HALF_DAY_THRESHOLD = 240;

// Time string that separates morning from afternoon sessions
export const AFTERNOON_START = '13:30:00';

// (Optional) Additional constants for flexibility
export const MORNING_END = '12:59:59';
export const STANDARD_SHIFT_START = '09:00:00';
export const STANDARD_SHIFT_END = '17:30:00';

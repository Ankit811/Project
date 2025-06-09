// utils/date.js

/**
 * Normalize a date to midnight (00:00:00).
 * @param {Date|string} date
 * @returns {Date}
 */
function normalizeDate(date) {
    const d = new Date(date);
    d.setHours(0, 0, 0, 0);
    return d;
  }
  
  /**
   * Normalize a date and return its timestamp for OT comparison.
   * @param {Date|string} date
   * @returns {number}
   */
  function normalizeOTDate(date) {
    return normalizeDate(date).getTime();
  }
  
  export  {
    normalizeDate,
    normalizeOTDate,
  };
  
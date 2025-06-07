// utils/leave.js

import { normalizeDate } from '../date.js';

/**
 * Calculate the number of days for a leave record.
 * Handles both half-day and full-day leaves.
 * @param {Object} leave
 * @returns {number}
 */
function calculateDays(leave) {
  if (leave.halfDay && leave.halfDay.date) {
    // If both halfDay and fullDay are present, prioritize half-day
    return 0.5;
  }
  if (leave.fullDay && leave.fullDay.from && leave.fullDay.to) {
    const from = normalizeDate(leave.fullDay.from);
    const to = normalizeDate(leave.fullDay.to);
    if (from > to) return 0;
    return ((to - from) / (1000 * 60 * 60 * 24)) + 1;
  }
  return 0;
}

/**
 * Deduplicate leaves by their fullDay date range.
 * @param {Array} leaves
 * @returns {Array}
 */
function deduplicateLeaves(leaves) {
  const seenRanges = new Set();
  return leaves.filter(leave => {
    if (leave.fullDay && leave.fullDay.from && leave.fullDay.to) {
      const rangeKey = `${normalizeDate(leave.fullDay.from).toISOString()}-${normalizeDate(leave.fullDay.to).toISOString()}`;
      if (seenRanges.has(rangeKey)) return false;
      seenRanges.add(rangeKey);
      return true;
    }
    return true;
  });
}

/**
 * Deduct paid leaves (Casual only)
 */
async function deductPaidLeaves(employee, leaveStart, leaveEnd) {
    if (!leaveStart || !leaveEnd) return;
    const days = calculateLeaveDays(leaveStart, leaveEnd);
    employee.paidLeaves = Math.max(0, (employee.paidLeaves || 0) - days);
    await employee.save();
  }
  
  /**
   * Deduct medical leaves
   */
  async function deductMedicalLeaves(employee, days) {
    employee.medicalLeaves = Math.max(0, (employee.medicalLeaves || 0) - days);
    await employee.save();
  }
  
  /**
   * Deduct restricted holidays
   */
  async function deductRestrictedHolidays(employee) {
    employee.restrictedHolidays = Math.max(0, (employee.restrictedHolidays || 0) - 1);
    await employee.save();
  }
  
  /**
   * Add compensatory leave entry
   */
  async function addCompensatoryLeave(employee, date, hours) {
    if (![4, 8].includes(hours)) throw new Error('Compensatory leave must be 4 or 8 hours');
    employee.compensatoryAvailable.push({ date, hours, status: 'Available' });
    employee.compensatoryLeaves = (employee.compensatoryLeaves || 0) + hours;
    await employee.save();
  }
  
  /**
   * Deduct compensatory leaves
   */
  async function deductCompensatoryLeaves(employee, entryId) {
    const entry = employee.compensatoryAvailable.find(e => e._id.toString() === entryId && e.status === 'Available');
    if (!entry) throw new Error('Invalid or already claimed compensatory leave entry');
    entry.status = 'Claimed';
    employee.compensatoryLeaves = Math.max(0, (employee.compensatoryLeaves || 0) - entry.hours);
    const days = entry.hours === 4 ? 0.5 : 1;
    employee.paidLeaves = (employee.paidLeaves || 0) + days;
    await employee.save();
  }
  
  /**
   * Increment unpaid leaves taken
   */
  async function incrementUnpaidLeaves(employee, leaveStart, leaveEnd) {
    if (!leaveStart || !leaveEnd) return;
    const days = calculateLeaveDays(leaveStart, leaveEnd);
    employee.unpaidLeavesTaken = (employee.unpaidLeavesTaken || 0) + days;
    await employee.save();
  }

export  {
  calculateDays,
  deduplicateLeaves,
  deductPaidLeaves,
  deductMedicalLeaves,
  deductRestrictedHolidays,
  addCompensatoryLeave,
  deductCompensatoryLeaves,
  incrementUnpaidLeaves,
};

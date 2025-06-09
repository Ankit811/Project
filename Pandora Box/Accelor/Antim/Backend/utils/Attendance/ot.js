// utils/ot.js

import { normalizeOTDate } from '../date.js';

/**
 * Separate unclaimed and claimed OT attendance records.
 * @param {Array} otAttendanceRecords
 * @param {Array} otClaims
 * @returns {Object} { unclaimedOTRecords, claimedOTRecords }
 */
function separateOTRecords(otAttendanceRecords, otClaims) {
  const unclaimedOTRecords = otAttendanceRecords
    .filter(record => {
      const recordDate = normalizeOTDate(record.logDate);
      const isClaimed = otClaims.some(claim => normalizeOTDate(claim.date) === recordDate);
      return !isClaimed;
    })
    .map(record => ({
      _id: record._id,
      date: record.logDate,
      hours: (record.ot / 60).toFixed(1),
      day: new Date(record.logDate).toLocaleString('en-US', { weekday: 'long' }),
      claimDeadline: new Date(record.logDate.getTime() + 24 * 60 * 60 * 1000),
    }));

  const claimedOTRecords = otClaims.map(claim => ({
    _id: claim._id,
    date: claim.date,
    hours: claim.hours.toFixed(1),
    day: new Date(claim.date).toLocaleString('en-US', { weekday: 'long' }),
    status: {
      hod: claim.status.hod,
      admin: claim.status.admin,
      ceo: claim.status.ceo,
    },
    projectDetails: claim.projectDetails,
    claimType: claim.claimType,
  }));

  return { unclaimedOTRecords, claimedOTRecords };
}

export {
  separateOTRecords,
};

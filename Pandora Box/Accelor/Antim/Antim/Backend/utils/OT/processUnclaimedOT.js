import Attendance from '../../models/Attendance.js';
import Employee from '../../models/Employee.js';
import OTClaim from '../../models/OTClaim.js';
import Department from '../../models/Department.js';

async function processUnclaimedOT() {
  try {
    console.log('Running processUnclaimedOT...');
    const now = new Date();
    const yesterday = new Date(now);
    yesterday.setDate(now.getDate() - 1);
    yesterday.setHours(0, 0, 0, 0);

    // Eligible departments
    const eligibleDepartments = ['Production', 'Testing', 'AMETL', 'Admin'];
    const eligibleDeptIds = await Department.find({ name: { $in: eligibleDepartments } }).select('_id');

    // Find attendance records with unclaimed OT from yesterday
    const attendanceRecords = await Attendance.find({
      logDate: yesterday,
      ot: { $gte: 60 }, // At least 1 hour (60 minutes)
    });

    for (const record of attendanceRecords) {
      const otHours = record.ot / 60;
      // Fetch employee by employeeId (string)
      let employee;
      try {
        employee = await Employee.findOne({ employeeId: record.employeeId }).populate('department');
        if (!employee) {
          console.warn(`No employee found for employeeId: ${record.employeeId}`);
          continue;
        }
      } catch (err) {
        console.error(`Error fetching employee for employeeId: ${record.employeeId}`, err.message);
        continue;
      }

      // Check if OT was claimed
      const claimDeadline = new Date(yesterday);
      claimDeadline.setDate(claimDeadline.getDate() + 1);
      claimDeadline.setHours(23, 59, 59, 999);
      if (now <= claimDeadline) continue; // Skip if still claimable

      const existingClaim = await OTClaim.findOne({
        employeeId: record.employeeId,
        date: { $gte: yesterday, $lte: yesterday },
      });
      if (existingClaim) continue;

      let compensatoryHours = 0;
      const isEligible = eligibleDeptIds.some(id => id.equals(employee.department._id));
      if (isEligible) {
        // Eligible departments: process OT ≥ 4 hours
        if (otHours >= 4) {
          compensatoryHours = otHours >= 8 ? 8 : 4; // Half-day or full-day
          // Excess hours (e.g., 6 - 4 = 2) are wasted
        }
        // OT < 4 hours is wasted (no compensatory leave)
      } else {
        // Non-eligible departments: Sundays only
        if (yesterday.getDay() === 0 && otHours >= 4) {
          compensatoryHours = otHours >= 8 ? 8 : 4; // Half-day or full-day
        }
        // OT < 4 hours or non-Sundays are wasted
      }

      if (compensatoryHours > 0) {
        try {
          await employee.addCompensatoryLeave(yesterday, compensatoryHours);
          record.ot = 0; // Mark OT as processed
          await record.save();
          console.log(`Added ${compensatoryHours}h compensatory leave for employee ${record.employeeId} on ${yesterday.toISOString()}`);
        } catch (err) {
          console.error(`Error adding compensatory leave for employee ${record.employeeId}`, err.message);
          continue;
        }
      } else {
        record.ot = 0; // Mark OT as wasted
        await record.save();
        console.log(`Wasted ${otHours}h OT for employee ${record.employeeId} on ${yesterday.toISOString()}`);
      }
    }

    console.log('processUnclaimedOT completed.');
  } catch (err) {
    console.error('Error processing unclaimed OT:', err.message, err.stack);
  }
}

export  { processUnclaimedOT };

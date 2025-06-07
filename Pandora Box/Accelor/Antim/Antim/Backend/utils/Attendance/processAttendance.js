// refactored processAttendance.js
import { markAbsentEmployees, updateTimeOutForYesterday } from './attendanceUtils.js';

const processLateArrivalsAndAbsents = async () => {
  try {
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    const yesterday = new Date(today);
    yesterday.setDate(today.getDate() - 1);

    console.log('📌 Marking absentees for today...');
    await markAbsentEmployees(today);

    console.log('📌 Updating timeOut for yesterday...');
    await updateTimeOutForYesterday(yesterday);

    console.log('✅ Late arrivals and absentees processing complete.');
  } catch (err) {
    console.error('❌ Error processing attendance:', err.message);
  }
};

export { processLateArrivalsAndAbsents };
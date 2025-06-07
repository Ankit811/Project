import { schedule } from 'node-cron';
import { syncAttendance } from '../utils/Attendance/syncAttendance.js';
import { processLateArrivalsAndAbsents } from '../utils/Attendance/processAttendance.js';
import { processUnclaimedOT } from '../utils/OT/processUnclaimedOT.js';

// Schedule jobs for attendance and OT processing
const initializeScheduledJobs = () => {
  // Sync attendance at 9:30 AM and 2:00 PM daily
  schedule('30 9 * * *', async () => {
    console.log('Running syncAttendance at 9:30 AM...');
    try {
      await syncAttendance();
      console.log('syncAttendance at 9:30 AM completed.');
    } catch (error) {
      console.error('syncAttendance at 9:30 AM failed:', error);
    }
  });

  schedule('0 14 * * *', async () => {
    console.log('Running syncAttendance at 2:00 PM...');
    try {
      await syncAttendance();
      console.log('syncAttendance at 2:00 PM completed.');
    } catch (error) {
      console.error('syncAttendance at 2:00 PM failed:', error);
    }
  });

  // Process late arrivals and absents at 9:30 AM daily
  schedule('30 9 * * *', async () => {
    console.log('Running processLateArrivalsAndAbsents at 9:30 AM...');
    try {
      await processLateArrivalsAndAbsents();
      console.log('processLateArrivalsAndAbsents at 9:30 AM completed.');
    } catch (error) {
      console.error('processLateArrivalsAndAbsents at 9:30 AM failed:', error);
    }
  });

  // Process unclaimed OT at 12:30 AM daily
  schedule('30 0 * * *', async () => {
    console.log('Running processUnclaimedOT at 12:30 AM...');
    try {
      await processUnclaimedOT();
      console.log('processUnclaimedOT at 12:30 AM completed.');
    } catch (error) {
      console.error('processUnclaimedOT at 12:30 AM failed:', error);
    }
  });

  console.log('Scheduled jobs initialized');
};

export default initializeScheduledJobs;
import { schedule } from 'node-cron';
import { syncAttendance } from '../utils/Attendance/syncAttendance.js';
import { processLateArrivalsAndAbsents } from '../utils/Attendance/processAttendance.js';
import { processUnclaimedOT } from '../utils/OT/processUnclaimedOT.js';

// Schedule jobs for attendance and OT processing
const scheduledJobs = {
  jobs: [],
  cleanup: async () => {
    console.log('Cleaning up scheduled jobs...');
    this.jobs.forEach(job => {
      job.stop();
    });
    console.log('All scheduled jobs stopped');
  },
  
  getJobStats: () => {
    return {
      totalJobs: this.jobs.length,
      activeJobs: this.jobs.filter(j => j.running).length,
      pendingJobs: this.jobs.filter(j => !j.running).length
    };
  }
};

const withRetry = async (fn, name, maxRetries = 3) => {
  let retries = 0;
  while (retries < maxRetries) {
    try {
      await fn();
      return true;
    } catch (error) {
      retries++;
      console.error(`Job ${name} failed (attempt ${retries}/${maxRetries}):`, error);
      if (retries === maxRetries) {
        console.error(`Job ${name} failed after ${maxRetries} retries`);
        return false;
      }
      await new Promise(resolve => setTimeout(resolve, 5000));
    }
  }
  return false;
};

const initializeScheduledJobs = () => {
  // Schedule jobs for attendance and OT processing
  const job1 = schedule('30 9 * * *', async () => {
    console.log('Running syncAttendance at 9:30 AM...');
    await withRetry(syncAttendance, 'syncAttendance 9:30 AM');
  });
  
  const job2 = schedule('0 14 * * *', async () => {
    console.log('Running syncAttendance at 2:00 PM...');
    await withRetry(syncAttendance, 'syncAttendance 14:00');
  });
  
  const job3 = schedule('30 9 * * *', async () => {
    console.log('Running processLateArrivalsAndAbsents at 9:30 AM...');
    await withRetry(processLateArrivalsAndAbsents, 'processLateArrivalsAndAbsents 9:30 AM');
  });
  
  const job4 = schedule('30 0 * * *', async () => {
    console.log('Running processUnclaimedOT at 12:30 AM...');
    await withRetry(processUnclaimedOT, 'processUnclaimedOT 0:30 AM');
  });

  // Store jobs in array
  scheduledJobs.jobs = [job1, job2, job3, job4];

  console.log('Scheduled jobs initialized');
  return scheduledJobs;
};

export default initializeScheduledJobs;
import { schedule } from 'node-cron';
import { syncAttendance } from '../utils/syncAttendance.js';
import { processLateArrivalsAndAbsents } from '../utils/processAttendance.js';
import { processUnclaimedOT } from '../utils/processUnclaimedOT.js';

// Job configuration
const JOB_CONFIG = {
  MAX_RETRIES: 3,
  RETRY_DELAY: 5000,
  MAX_FAILURES: 5,
  ALERT_THRESHOLD: 3
};

// Job state tracking
const jobStates = {
  jobs: new Map(),
  failures: new Map(),
  running: new Set()
};

// Enhanced job management
const scheduledJobs = {
  jobs: [],
  cleanup: async () => {
    console.log('Cleaning up scheduled jobs...');
    scheduledJobs.jobs.forEach(job => {
      job.stop();
    });
    console.log('All scheduled jobs stopped');
    // Clear job states
    jobStates.jobs.clear();
    jobStates.failures.clear();
    jobStates.running.clear();
  },
  
  getJobStats: () => {
    return {
      totalJobs: scheduledJobs.jobs.length,
      activeJobs: scheduledJobs.jobs.filter(j => j.running).length,
      runningJobs: jobStates.running.size,
      failedJobs: Array.from(jobStates.failures.entries()).filter(([_, count]) => count >= JOB_CONFIG.MAX_FAILURES).length,
      executionHistory: Array.from(jobStates.jobs.values()).map(j => ({
        name: j.name,
        lastRun: j.lastRun,
        lastSuccess: j.lastSuccess,
        lastFailure: j.lastFailure,
        failures: j.failures,
        executionTime: j.executionTime
      }))
    };
  }
};

// Enhanced retry mechanism with circuit breaker
const withRetry = async (fn, name, maxRetries = JOB_CONFIG.MAX_RETRIES) => {
  const jobKey = `${name}-${new Date().toISOString().split('T')[0]}`;
  
  // Check if job is already running
  if (jobStates.running.has(jobKey)) {
    console.warn(`Job ${name} is already running - skipping execution`);
    return false;
  }

  try {
    // Mark job as running
    jobStates.running.add(jobKey);
    
    // Get job state or initialize new one
    let jobState = jobStates.jobs.get(jobKey) || {
      name,
      lastRun: null,
      lastSuccess: null,
      lastFailure: null,
      failures: 0,
      executionTime: 0
    };

    const startTime = Date.now();
    
    // Execute with retries
    let retries = 0;
    while (retries < maxRetries) {
      try {
        await fn();
        // Success - update state
        jobState.lastRun = new Date();
        jobState.lastSuccess = new Date();
        jobState.failures = 0;
        jobState.executionTime = Date.now() - startTime;
        jobStates.jobs.set(jobKey, jobState);
        jobStates.running.delete(jobKey);
        return true;
      } catch (error) {
        retries++;
        const errorMessage = `Job ${name} failed (attempt ${retries}/${maxRetries}): ${error.message}`;
        console.error(errorMessage);
        
        // Update failure state
        jobState.lastRun = new Date();
        jobState.lastFailure = new Date();
        jobState.failures++;
        jobStates.jobs.set(jobKey, jobState);
        
        // Check if we need to alert
        if (jobState.failures >= JOB_CONFIG.ALERT_THRESHOLD) {
          console.error(`ALERT: Job ${name} has failed ${jobState.failures} times in a row`);
        }
        
        // Circuit breaker - stop trying if too many failures
        if (jobState.failures >= JOB_CONFIG.MAX_FAILURES) {
          console.error(`CIRCUIT BREAKER: Job ${name} disabled due to ${JOB_CONFIG.MAX_FAILURES} consecutive failures`);
          jobStates.failures.set(jobKey, jobState.failures);
          jobStates.running.delete(jobKey);
          return false;
        }
        
        if (retries === maxRetries) {
          console.error(`Job ${name} failed after ${maxRetries} retries`);
          jobStates.running.delete(jobKey);
          return false;
        }
        
        await new Promise(resolve => setTimeout(resolve, JOB_CONFIG.RETRY_DELAY));
      }
    }
    
    jobStates.running.delete(jobKey);
    return false;
  } catch (error) {
    console.error(`Job ${name} encountered unexpected error:`, error);
    jobStates.running.delete(jobKey);
    return false;
  }
};

const initializeScheduledJobs = () => {
  // Define job configurations
  const jobs = [
    {
      name: 'syncAttendance-9:30',
      schedule: '30 9 * * *',
      task: syncAttendance,
      description: 'Sync attendance at 9:30 AM'
    },
    {
      name: 'syncAttendance-14:00',
      schedule: '0 14 * * *',
      task: syncAttendance,
      description: 'Sync attendance at 2:00 PM'
    },
    {
      name: 'processLateArrivals-9:30',
      schedule: '30 9 * * *',
      task: processLateArrivalsAndAbsents,
      description: 'Process late arrivals and absents at 9:30 AM'
    },
    {
      name: 'processUnclaimedOT-0:30',
      schedule: '30 0 * * *',
      task: processUnclaimedOT,
      description: 'Process unclaimed OT at 12:30 AM'
    }
  ];

  // Create and schedule jobs
  const scheduled = jobs.map(job => {
    const scheduledJob = schedule(job.schedule, async () => {
      console.log(`[${new Date().toISOString()}] Starting ${job.description}`);
      const success = await withRetry(job.task, job.name);
      if (success) {
        console.log(`[${new Date().toISOString()}] Completed ${job.description} successfully`);
      } else {
        console.error(`[${new Date().toISOString()}] Failed to complete ${job.description}`);
      }
    });
    return scheduledJob;
  });

  // Store jobs in array
  scheduledJobs.jobs = scheduled;

  console.log('Scheduled jobs initialized');
  return scheduledJobs;
};

export default initializeScheduledJobs;
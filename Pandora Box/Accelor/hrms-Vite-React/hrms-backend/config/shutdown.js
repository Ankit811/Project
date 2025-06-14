// shutdown.js
import { setTimeout } from 'timers/promises';

// Shutdown configuration
const SHUTDOWN_CONFIG = {
  INITIAL_TIMEOUT: 30000, // 30 seconds initial timeout
  CLEANUP_INTERVAL: 5000, // 5 seconds between cleanup checks
  MAX_RETRIES: 3,        // Max retries for cleanup operations
  MAX_TIMEOUT_EXTENSION: 60000 // 60 seconds max extension
};

// Shutdown state management
const shutdownState = {
  isShuttingDown: false,
  shutdownReason: null,
  shutdownStartTime: null,
  cleanupAttempts: 0,
  cleanupProgress: {
    server: false,
    websockets: false,
    database: false,
    jobs: false
  }
};

// Cleanup verification with retries
const verifyCleanup = async (dbConnection, io, scheduledJobs) => {
  const maxRetries = SHUTDOWN_CONFIG.MAX_RETRIES;
  let retries = 0;

  while (retries < maxRetries) {
    try {
      // Verify database cleanup
      if (dbConnection.readyState === 1) {
        throw new Error('Database connection not closed');
      }
      shutdownState.cleanupProgress.database = true;
      
      // Verify WebSocket cleanup
      if (io && io.sockets.sockets.size > 0) {
        throw new Error('WebSocket connections not closed');
      }
      shutdownState.cleanupProgress.websockets = true;
      
      // Verify scheduled jobs cleanup
      if (scheduledJobs && scheduledJobs.jobs.some(j => j.running)) {
        throw new Error('Scheduled jobs not stopped');
      }
      shutdownState.cleanupProgress.jobs = true;
      
      console.log('All cleanup operations verified successfully');
      return true;
    } catch (error) {
      retries++;
      console.error(`Cleanup verification failed (attempt ${retries}/${maxRetries}):`, error);
      
      if (retries === maxRetries) {
        console.error(`Cleanup verification failed after ${maxRetries} attempts`);
        return false;
      }
      
      await new Promise(resolve => setTimeout(resolve, SHUTDOWN_CONFIG.CLEANUP_INTERVAL));
    }
  }
  return false;
};

// Graceful shutdown with timeout extension
export const gracefulShutdown = async (server, io, dbConnection, scheduledJobs) => {
  return new Promise(async (resolve, reject) => {
    try {
      // Check if already shutting down
      if (shutdownState.isShuttingDown) {
        console.warn('Shutdown already in progress');
        return reject(new Error('Shutdown already in progress'));
      }

      // Mark shutdown start
      shutdownState.isShuttingDown = true;
      shutdownState.shutdownReason = 'MANUAL';
      shutdownState.shutdownStartTime = new Date();
      shutdownState.cleanupAttempts = 0;
      shutdownState.cleanupProgress = {
        server: false,
        websockets: false,
        database: false,
        jobs: false
      };

      console.log('Initiating graceful shutdown...');
      
      // 1. Stop accepting new connections
      try {
        await new Promise((resolve, reject) => {
          server.close((err) => {
            if (err) {
              console.error('Error during server close:', err);
              reject(err);
              return;
            }
            console.log('Server closed successfully');
            shutdownState.cleanupProgress.server = true;
            resolve();
          });
        });
      } catch (error) {
        console.error('Failed to close server:', error);
        throw error;
      }

      // 2. Close WebSocket connections gracefully
      if (io) {
        try {
          console.log('Closing WebSocket connections...');
          
          // Get all connected clients
          const clients = io.sockets.sockets;
          Object.values(clients).forEach(client => {
            // Disconnect with reason
            client.disconnect(true);
          });
          
          // Wait for all clients to disconnect with timeout
          await new Promise((resolve) => {
            const interval = setInterval(() => {
              if (Object.keys(io.sockets.sockets).length === 0) {
                clearInterval(interval);
                resolve();
              }
            }, SHUTDOWN_CONFIG.CLEANUP_INTERVAL);
          }).timeout(SHUTDOWN_CONFIG.INITIAL_TIMEOUT);
          
          shutdownState.cleanupProgress.websockets = true;
        } catch (error) {
          console.error('Failed to close WebSocket connections:', error);
          throw error;
        }
      }

      // 3. Cleanup database connections
      if (dbConnection) {
        try {
          console.log('Closing database connections...');
          await dbConnection.close();
          shutdownState.cleanupProgress.database = true;
        } catch (error) {
          console.error('Failed to close database connections:', error);
          throw error;
        }
      }

      // 4. Cleanup scheduled jobs
      if (scheduledJobs) {
        try {
          console.log('Cleaning up scheduled jobs...');
          await scheduledJobs.cleanup();
          shutdownState.cleanupProgress.jobs = true;
        } catch (error) {
          console.error('Failed to cleanup scheduled jobs:', error);
          throw error;
        }
      }

      // 5. Wait for existing connections to finish with timeout extension
      let currentTimeout = SHUTDOWN_CONFIG.INITIAL_TIMEOUT;
      let totalWaitTime = 0;
      
      while (totalWaitTime < SHUTDOWN_CONFIG.MAX_TIMEOUT_EXTENSION) {
        try {
          console.log(`Waiting for existing connections to finish (timeout: ${currentTimeout/1000}s)...`);
          await setTimeout(currentTimeout);
          totalWaitTime += currentTimeout;
          
          // Verify cleanup
          const cleanupSuccess = await verifyCleanup(dbConnection, io, scheduledJobs);
          if (cleanupSuccess) {
            break;
          }
          
          // Extend timeout if cleanup is not complete
          currentTimeout = Math.min(currentTimeout * 2, SHUTDOWN_CONFIG.MAX_TIMEOUT_EXTENSION - totalWaitTime);
        } catch (error) {
          console.error('Timeout extension failed:', error);
          throw error;
        }
      }

      // 6. Force close any remaining connections
      console.log('Forcing shutdown...');
      process.exit(0);
    } catch (error) {
      console.error('Error during shutdown:', error);
      reject(error);
    }
  });
};

// Register shutdown handlers with synchronization
export const registerShutdownHandlers = (server, io, dbConnection, scheduledJobs) => {
  // Handle SIGTERM (Docker stop, Kubernetes pod termination)
  process.on('SIGTERM', async () => {
    console.log('Received SIGTERM signal');
    if (!shutdownState.isShuttingDown) {
      shutdownState.shutdownReason = 'SIGTERM';
      await gracefulShutdown(server, io, dbConnection, scheduledJobs);
    }
  });

  // Handle SIGINT (Ctrl+C)
  process.on('SIGINT', async () => {
    console.log('Received SIGINT signal');
    if (!shutdownState.isShuttingDown) {
      shutdownState.shutdownReason = 'SIGINT';
      await gracefulShutdown(server, io, dbConnection, scheduledJobs);
    }
  });

  // Handle uncaught exceptions
  process.on('uncaughtException', async (error) => {
    console.error('Uncaught exception:', error);
    if (!shutdownState.isShuttingDown) {
      shutdownState.shutdownReason = 'UNCAUGHT_EXCEPTION';
      await gracefulShutdown(server, io, dbConnection, scheduledJobs);
    }
  });

  // Handle unhandled promise rejections
  process.on('unhandledRejection', async (reason) => {
    console.error('Unhandled rejection:', reason);
    if (!shutdownState.isShuttingDown) {
      shutdownState.shutdownReason = 'UNHANDLED_REJECTION';
      await gracefulShutdown(server, io, dbConnection, scheduledJobs);
    }
  });

  // Add health check endpoint
  return {
    isShuttingDown: () => shutdownState.isShuttingDown,
    getShutdownReason: () => shutdownState.shutdownReason,
    getShutdownProgress: () => shutdownState.cleanupProgress,
    getShutdownStartTime: () => shutdownState.shutdownStartTime
  };
};

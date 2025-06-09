// shutdown.js
import { setTimeout } from 'timers/promises';

const SHUTDOWN_TIMEOUT = 30000; // 30 seconds timeout
const CLEANUP_INTERVAL = 5000; // 5 seconds between cleanup checks

// Health check status
let isShuttingDown = false;
let shutdownReason = null;

// Add cleanup verification
const verifyCleanup = async (dbConnection, io, scheduledJobs) => {
  try {
    // Verify database cleanup
    if (dbConnection.readyState === 1) {
      throw new Error('Database connection not closed');
    }
    
    // Verify WebSocket cleanup
    if (io && io.sockets.sockets.size > 0) {
      throw new Error('WebSocket connections not closed');
    }
    
    // Verify scheduled jobs cleanup
    if (scheduledJobs && scheduledJobs.jobs.some(j => j.running)) {
      throw new Error('Scheduled jobs not stopped');
    }
    
    console.log('All cleanup operations verified successfully');
  } catch (error) {
    console.error('Cleanup verification failed:', error);
  }
};

export const gracefulShutdown = async (server, io, dbConnection, scheduledJobs) => {
  return new Promise(async (resolve, reject) => {
    try {
      isShuttingDown = true;
      console.log('Initiating graceful shutdown...');

      // 1. Stop accepting new connections
      server.close((err) => {
        if (err) {
          console.error('Error during server close:', err);
          reject(err);
          return;
        }
        console.log('Server closed successfully');
      });

      // 2. Close WebSocket connections gracefully
      if (io) {
        console.log('Closing WebSocket connections...');
        
        // Get all connected clients
        const clients = io.sockets.sockets;
        Object.values(clients).forEach(client => {
          // Disconnect with reason
          client.disconnect(true);
        });
        
        // Wait for all clients to disconnect
        await new Promise(resolve => {
          const interval = setInterval(() => {
            if (Object.keys(io.sockets.sockets).length === 0) {
              clearInterval(interval);
              resolve();
            }
          }, CLEANUP_INTERVAL);
        });
      }

      // 3. Cleanup database connections
      if (dbConnection) {
        console.log('Closing database connections...');
        await dbConnection.close();
      }

      // 4. Cleanup scheduled jobs
      if (scheduledJobs) {
        console.log('Cleaning up scheduled jobs...');
        await scheduledJobs.cleanup();
      }

      // 5. Wait for existing connections to finish
      console.log('Waiting for existing connections to finish...');
      await setTimeout(SHUTDOWN_TIMEOUT);

      // 6. Verify cleanup
      await verifyCleanup(dbConnection, io, scheduledJobs);

      // 7. Force close any remaining connections
      console.log('Forcing shutdown...');
      process.exit(0);
    } catch (error) {
      console.error('Error during shutdown:', error);
      reject(error);
    }
  });
};

// Register shutdown handlers
export const registerShutdownHandlers = (server, io, dbConnection, scheduledJobs) => {
  // Handle SIGTERM (Docker stop, Kubernetes pod termination)
  process.on('SIGTERM', async () => {
    console.log('Received SIGTERM signal');
    shutdownReason = 'SIGTERM';
    await gracefulShutdown(server, io, dbConnection, scheduledJobs);
  });

  // Handle SIGINT (Ctrl+C)
  process.on('SIGINT', async () => {
    console.log('Received SIGINT signal');
    shutdownReason = 'SIGINT';
    await gracefulShutdown(server, io, dbConnection, scheduledJobs);
  });

  // Handle uncaught exceptions
  process.on('uncaughtException', async (error) => {
    console.error('Uncaught exception:', error);
    shutdownReason = 'UNCAUGHT_EXCEPTION';
    await gracefulShutdown(server, io, dbConnection, scheduledJobs);
  });

  // Handle unhandled promise rejections
  process.on('unhandledRejection', async (reason) => {
    console.error('Unhandled rejection:', reason);
    shutdownReason = 'UNHANDLED_REJECTION';
    await gracefulShutdown(server, io, dbConnection, scheduledJobs);
  });

  // Add health check endpoint
  return {
    isShuttingDown,
    getShutdownReason: () => shutdownReason
  };
};

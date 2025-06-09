// server.js
import { config } from 'dotenv';
config();
import express from 'express';
import { createServer } from 'http';
import cors from 'cors';

import connectDatabase from './config/modb.js';
import { cleanupDatabase } from './config/modb.js';
import initializeSocket from './config/socker.js';
import initializeScheduledJobs from './config/cron.js';
import registerRoutes from './routes/main.js';
import { corsOptions, allowedOrigins } from './config/cors.js';
import { gfsReady } from './utils/sauth/gridfs.js';
import { registerShutdownHandlers } from './config/shutdown.js';

// Add health check endpoint
app.get('/health', (req, res) => {
  const { isShuttingDown, getShutdownReason } = req.app.get('shutdownStatus');
  res.json({
    status: isShuttingDown ? 'shutting_down' : 'healthy',
    shutdownReason: getShutdownReason(),
    timestamp: new Date().toISOString()
  });
});

const app = express();
const server = createServer(app);
const PORT = process.env.PORT || 5000;

// Middleware
app.use(cors(corsOptions));
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Initialize components
const startServer = async () => {
  try {
    const dbConnection = await connectDatabase();
    const io = initializeSocket(server, allowedOrigins);
    const scheduledJobs = initializeScheduledJobs();
    
    // Store the cleanup functions in app
    app.set('cleanupFunctions', {
      dbConnection: cleanupDatabase,
      scheduledJobs: () => scheduledJobs.cleanup()
    });
    
    registerRoutes(app);
    
    // Register shutdown handlers
    const shutdownStatus = registerShutdownHandlers(server, io, dbConnection, scheduledJobs);
    app.set('shutdownStatus', shutdownStatus);
    
    const PORT = process.env.PORT || 5005;
    server.listen(PORT, () => console.log(`Server running on port ${PORT}`));
  } catch (error) {
    console.error('Server startup error:', error);
    process.exit(1);
  } 
};

startServer();


startServer();

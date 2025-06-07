// server.js
import { config } from 'dotenv';
config();
import express from 'express';
import { createServer } from 'http';
import cors from 'cors';

import connectDatabase from './config/modb.js';
import initializeSocket from './config/socker.js';
import initializeScheduledJobs from './config/cron.js';
import registerRoutes from './routes/main.js';
import { corsOptions, allowedOrigins } from './config/cors.js';
import { gfsReady } from './utils/sauth/gridfs.js';

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
    await connectDatabase();
    initializeSocket(server, allowedOrigins);
    registerRoutes(app);
    if (gfsReady()) {
      initializeScheduledJobs();
    }
    // Add to your server startup


    // server.listen(5005, '192.168.1.25', () => {
    //   console.log('Server running on http://192.168.1.25:5005');
    // });
    const PORT = process.env.PORT || 5005;
        server.listen(PORT, () => console.log(`Server running on port ${PORT}`));
  } catch (error) {
    console.error('Server startup error:', error);
    process.exit(1);
  }
};


startServer();

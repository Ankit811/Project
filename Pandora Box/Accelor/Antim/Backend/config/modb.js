// config/database.js
import mongoose from 'mongoose';
import { gfsReady } from '../utils/sauth/gridfs.js';

const MAX_RETRIES = 5;
const RETRY_DELAY = 5000; // 5 seconds between retries

const connection = mongoose.connection;

// Add connection monitoring
connection.on('connection', (conn) => {
  console.log('MongoDB connection established:', {
    host: conn.host,
    port: conn.port,
    name: conn.name
  });
});

// Add performance monitoring
connection.on('open', () => {
  console.log('MongoDB connection pool stats:', {
    connections: connection.connections.length,
    maxPoolSize: connection.options.maxPoolSize,
    minPoolSize: connection.options.minPoolSize
  });
});

// Connection handlers
connection.on('connected', () => {
  console.log('MongoDB connected successfully');
});

connection.on('error', (error) => {
  console.error('MongoDB connection error:', error);
  connection.emit('disconnected'); // Trigger reconnection
});

// Global retry state
let isReconnecting = false;
const RECONNECT_INTERVAL = 5000; // 5 seconds between reconnection attempts

connection.on('disconnected', async () => {
  console.log('MongoDB disconnected');
  
  if (isReconnecting) {
    console.log('Reconnection already in progress');
    return;
  }

  isReconnecting = true;
  
  try {
    // Use the same retry logic as initial connection
    await connectWithRetry(process.env.MONGO_URI, {
      serverSelectionTimeoutMS: 5000,
      socketTimeoutMS: 45000,
      connectTimeoutMS: 30000,
      retryWrites: true,
      w: 'majority',
      autoIndex: false,
      bufferMaxEntries: 0,
      keepAlive: true,
      keepAliveInitialDelay: 300000
    });
    
    console.log('Successfully reconnected to MongoDB');
    isReconnecting = false;
  } catch (error) {
    console.error('Failed to reconnect to MongoDB:', error);
    isReconnecting = false;
    // Don't throw error here, just log it
    // The next disconnection will trigger another reconnection attempt
  }
});

connection.on('reconnected', () => {
  console.log('MongoDB reconnected successfully');
  isReconnecting = false;
});

// Connection retry logic
const connectWithRetry = async (uri, options) => {
  let retries = 0;
  
  while (retries < MAX_RETRIES) {
    try {
      await mongoose.connect(uri, options);
      console.log(`MongoDB connected after ${retries} retries`);
      return;
    } catch (error) {
      retries++;
      if (retries === MAX_RETRIES) {
        console.error('Failed to connect to MongoDB after', MAX_RETRIES, 'retries');
        throw error;
      }
      console.log(`MongoDB connection attempt ${retries} failed. Retrying in ${RETRY_DELAY/1000} seconds...`);
      await new Promise(resolve => setTimeout(resolve, RETRY_DELAY));
    }
  }
};

const connectDatabase = async () => {
  try {
    // Connection options with retry logic
    const options = {
      serverSelectionTimeoutMS: 5000,
      socketTimeoutMS: 45000,
      connectTimeoutMS: 30000,
      retryWrites: true,
      w: 'majority',
      autoIndex: false,
      bufferMaxEntries: 0,
      keepAlive: true,
      keepAliveInitialDelay: 300000,
    };

    // Attempt to connect with retry logic
    await connectWithRetry(process.env.MONGO_URI, options);

    // Wait for GridFS initialization with retry
    let gridFSRetries = 0;
    const GRIDFS_MAX_RETRIES = 3;
    const GRIDFS_RETRY_DELAY = 1000;

    return new Promise((resolve, reject) => {
      const timeout = setTimeout(() => {
        reject(new Error('GridFS initialization timeout'));
      }, 10000);

      const checkGridFS = setInterval(() => {
        if (gfsReady()) {
          clearInterval(checkGridFS);
          clearTimeout(timeout);
          console.log('GridFS initialized successfully');
          resolve();
        } else if (gridFSRetries < GRIDFS_MAX_RETRIES) {
          gridFSRetries++;
          console.log(`Waiting for GridFS initialization (attempt ${gridFSRetries}/${GRIDFS_MAX_RETRIES})...`);
        } else {
          clearInterval(checkGridFS);
          clearTimeout(timeout);
          reject(new Error('Failed to initialize GridFS after multiple attempts'));
        }
      }, GRIDFS_RETRY_DELAY);
    });
  } catch (error) {
    console.error('Database connection error:', error);
    // Don't exit immediately, let retry logic handle it
    throw error;
  }
};

// Export cleanup function for graceful shutdown
export const cleanupDatabase = async () => {
  try {
    if (connection.readyState === 1) {
      await connection.close();
      console.log('MongoDB connection closed successfully');
    }
  } catch (error) {
    console.error('Error closing MongoDB connection:', error);
  }
};

export default connectDatabase;

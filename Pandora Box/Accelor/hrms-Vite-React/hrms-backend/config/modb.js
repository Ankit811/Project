// config/database.js
import mongoose from 'mongoose';
import { gfsReady } from '../utils/gridfs.js';

// Connection configuration
const DB_CONFIG = {
  MAX_RETRIES: 5,
  RETRY_DELAY: 5000,
  ERROR_RETRY_DELAY: 1000,
  POOL_SIZE: {
    min: 5,
    max: 50
  },
  TIMEOUTS: {
    serverSelection: 5000,
    socket: 45000,
    connect: 30000
  }
};

// Connection state
const connectionState = {
  isConnected: false,
  isConnecting: false,
  isReconnecting: false,
  connectionAttempts: 0,
  lastConnectionTime: null,
  lastErrorTime: null
};

const connection = mongoose.connection;

// Event listeners
connection.on('connected', () => {
  connectionState.isConnected = true;
  connectionState.isConnecting = false;
  connectionState.isReconnecting = false;
  connectionState.connectionAttempts = 0;
  connectionState.lastConnectionTime = new Date();

  const client = connection?.client;
  const host = client?.s?.url || 'unknown host';
  console.log(`MongoDB connected successfully to ${host}`);

  console.log('MongoDB connection pool stats:', {
    connections: connection?.connections?.length || 0,
    maxPoolSize: DB_CONFIG.POOL_SIZE.max,
    minPoolSize: DB_CONFIG.POOL_SIZE.min
  });
});

connection.on('error', (error) => {
  console.error('MongoDB connection error:', error);
  connectionState.lastErrorTime = new Date();

  if (error.message.includes('server selection error')) {
    console.error('Server selection failed - attempting to reconnect');
    setTimeout(() => {
      if (!connectionState.isReconnecting && !connectionState.isConnecting) {
        handleReconnection();
      }
    }, DB_CONFIG.ERROR_RETRY_DELAY);
  }
});

connection.on('disconnected', () => {
  console.log('MongoDB disconnected');
  connectionState.isConnected = false;
  connectionState.isConnecting = false;
  handleReconnection();
});

// Reconnection logic
const handleReconnection = async () => {
  if (connectionState.isReconnecting || connectionState.isConnecting) {
    console.log('Reconnection already in progress');
    return;
  }

  connectionState.isReconnecting = true;
  connectionState.isConnecting = true;

  try {
    await connectWithRetry(process.env.MONGO_URI, getMongoOptions());
    console.log('Successfully reconnected to MongoDB');
  } catch (error) {
    console.error('Failed to reconnect to MongoDB:', error);
  } finally {
    connectionState.isReconnecting = false;
    connectionState.isConnecting = false;
  }
};

// Retry logic
const connectWithRetry = async (uri, options) => {
  let retries = 0;
  const MAX_DELAY = 30000;

  while (retries < DB_CONFIG.MAX_RETRIES) {
    try {
      console.log(`Attempting MongoDB connection (attempt ${retries + 1}/${DB_CONFIG.MAX_RETRIES})`);
      await mongoose.connect(uri, options);
      console.log(`MongoDB connected after ${retries} retries`);
      return;
    } catch (error) {
      retries++;
      const delay = Math.min(DB_CONFIG.RETRY_DELAY * 2 ** retries, MAX_DELAY);

      if (retries === DB_CONFIG.MAX_RETRIES) {
        console.error('Failed to connect to MongoDB after', DB_CONFIG.MAX_RETRIES, 'retries');
        throw error;
      }

      console.log(`MongoDB connection attempt ${retries} failed. Retrying in ${delay / 1000} seconds...`);
      await new Promise(resolve => setTimeout(resolve, delay));
    }
  }
};

// MongoDB options generator
const getMongoOptions = () => ({
  serverSelectionTimeoutMS: DB_CONFIG.TIMEOUTS.serverSelection,
  socketTimeoutMS: DB_CONFIG.TIMEOUTS.socket,
  connectTimeoutMS: DB_CONFIG.TIMEOUTS.connect,
  retryWrites: true,
  w: 'majority',
  autoIndex: false,
  maxPoolSize: DB_CONFIG.POOL_SIZE.max,
  minPoolSize: DB_CONFIG.POOL_SIZE.min
});

// Database connection
const connectDatabase = async () => {
  if (connectionState.isConnecting) {
    console.log('Connection attempt already in progress');
    return;
  }

  connectionState.isConnecting = true;

  try {
    await connectWithRetry(process.env.MONGO_URI, getMongoOptions());
    await waitForGridFSInitialization();
    return connection;
  } catch (error) {
    console.error('Database connection error:', error);
    throw error;
  } finally {
    connectionState.isConnecting = false;
  }
};

// GridFS init wait
const waitForGridFSInitialization = async () => {
  const MAX_RETRIES = 3;
  const RETRY_DELAY = 1000;
  const TIMEOUT = 10000;

  return new Promise((resolve, reject) => {
    let attempts = 0;
    const timeout = setTimeout(() => reject(new Error('GridFS initialization timeout')), TIMEOUT);

    const checkGridFS = setInterval(() => {
      if (gfsReady()) {
        clearInterval(checkGridFS);
        clearTimeout(timeout);
        console.log('GridFS initialized successfully');
        resolve();
      } else if (++attempts >= MAX_RETRIES) {
        clearInterval(checkGridFS);
        clearTimeout(timeout);
        reject(new Error('Failed to initialize GridFS after multiple attempts'));
      } else {
        console.log(`Waiting for GridFS initialization (attempt ${attempts}/${MAX_RETRIES})...`);
      }
    }, RETRY_DELAY);
  });
};

// Cleanup
export const cleanupDatabase = async () => {
  try {
    if (connectionState.isConnected || connectionState.isConnecting) {
      console.log('Initiating database cleanup...');
      await new Promise(resolve => setTimeout(resolve, 1000));
      await connection.close(true);
      console.log('MongoDB connection closed successfully');
      connectionState.isConnected = false;
      connectionState.isConnecting = false;
      connectionState.isReconnecting = false;
    }
  } catch (error) {
    console.error('Error during database cleanup:', error);
  }
};

export default connectDatabase;

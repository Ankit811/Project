// config/database.js
import { connect } from 'mongoose';
import { gfsReady } from '../utils/sauth/gridfs.js';

const connectDatabase = async () => {
  try {
    await connect(process.env.MONGO_URI);
    console.log('MongoDB connected');
    
    // Wait for GridFS initialization
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
        }
      }, 100);
    });
  } catch (error) {
    console.error('Database connection error:', error);
    process.exit(1);
  }
};

export default connectDatabase;

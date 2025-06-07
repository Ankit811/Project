// middleware/employeeMiddleware.js
import { gfsReady } from '../utils/sauth/gridfs.js';
import pkg from 'mongoose';
const { connection } = pkg;

const ensureGFS = (req, res, next) => {
  if (!gfsReady()) {
    return res.status(503).json({ message: 'File storage not available' });
  }
  next();
};

const ensureDbConnection = (req, res, next) => {
  if (connection.readyState !== 1) {
    return res.status(500).json({ message: 'Database connection not available' });
  }
  next();
};

export  { ensureGFS, ensureDbConnection };

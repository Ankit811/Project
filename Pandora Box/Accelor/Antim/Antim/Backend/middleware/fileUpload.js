// middleware/fileupload.js
import multer, { memoryStorage } from 'multer';
import { 
  uploadToGridFS, 
  processMultipleFiles, 
  FileUploadError,
  gfsReady 
} from '../utils/sauth/gridfs.js';
import { ensureGFS } from './gfs-db-check.js';

// Storage configuration
const storage = memoryStorage();

// File validation utilities (kept in middleware)
const validateFileType = (file) => {
  const isProfilePicture = file.fieldname === 'profilePicture';
  const isJpeg = isProfilePicture && (file.mimetype === 'image/jpeg' || file.mimetype === 'image/jpg');
  const isPdf = !isProfilePicture && file.mimetype === 'application/pdf';
  
  if (!isJpeg && !isPdf) {
    throw new Error(`Invalid file type for ${file.fieldname}. Only ${isProfilePicture ? 'JPEG/JPG images' : 'PDF files'} are allowed.`);
  }
  return true;
};

// Main multer configuration
const upload = multer({
  storage,
  limits: { fileSize: 5 * 1024 * 1024 }, // 5MB limit
  fileFilter: (req, file, cb) => {
    try {
      validateFileType(file);
      cb(null, true);
    } catch (err) {
      console.error('File filter error:', err);
      cb(new FileUploadError(err.message, 'INVALID_FILE_TYPE', file.fieldname));
    }
  },
});

// Excel upload configuration
const excelUpload = multer({
  storage,
  limits: { fileSize: 10 * 1024 * 1024 }, // 10MB limit
  fileFilter: (req, file, cb) => {
    try {
      if (file.mimetype !== 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' &&
          file.mimetype !== 'application/vnd.ms-excel') {
        throw new Error('Only Excel files (.xlsx, .xls) are allowed');
      }
      cb(null, true);
    } catch (err) {
      cb(new FileUploadError(err.message, 'INVALID_FILE_TYPE', file.fieldname));
    }
  },
});


export { 
  upload, 
  excelUpload,
  uploadToGridFS,
  processMultipleFiles,
  ensureGFS,
  gfsReady,
  validateFileType,
};

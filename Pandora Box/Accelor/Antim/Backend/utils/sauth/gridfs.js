// utils/gridfs.js
// ✅ Correct ES6 import for CommonJS modules
import mongoose from 'mongoose';
const { connection, mongo } = mongoose;
// services/gridfsService.js
import { Readable } from 'stream';

let gfs = null;


connection.once('open', () => {
  gfs = new mongo.GridFSBucket(connection.db, { bucketName: 'Uploads' });
  console.log('Central GridFS initialized');
});

const gfsReady = () => !!gfs;
const getGfs = () => gfs;




// Custom error class for file upload errors
class FileUploadError extends Error {
  constructor(message, code, field) {
    super(message);
    this.name = 'FileUploadError';
    this.code = code;
    this.field = field;
  }
}

// Upload a file buffer to GridFS
const uploadToGridFS = (file, metadata = {}) => {
  return new Promise((resolve, reject) => {
    if (!gfsReady()) {
      return reject(new Error('GridFS is not initialized'));
    }

    const gfs = getGfs();
    const readableStream = Readable.from(file.buffer);
    const uniqueFilename = generateUniqueFilename(file.originalname);
    
    const uploadStream = gfs.openUploadStream(uniqueFilename, {
      contentType: file.mimetype,
      metadata: {
        ...metadata,
        fieldname: file.fieldname,
        originalName: file.originalname,
        uploadDate: new Date(),
        fileSize: file.buffer.length,
        formattedSize: formatFileSize(file.buffer.length),
      },
    });

    readableStream.pipe(uploadStream)
      .on('error', (err) => {
        console.error('Upload stream error:', err);
        reject(new FileUploadError('GridFS upload failed', 'GRIDFS_ERROR', file.fieldname));
      })
      .on('finish', () => {
        console.log('Upload stream finished:', uploadStream.id);
        resolve({ 
          _id: uploadStream.id, 
          filename: uniqueFilename,
          originalName: file.originalname,
          size: file.buffer.length,
          contentType: file.mimetype
        });
      });
  });
};

// Delete a file from GridFS by fileId
const deleteFileFromGridFS = async (fileId) => {
  if (!gfsReady()) {
    throw new Error('GridFS is not initialized');
  }
  
  try {
    const gfs = getGfs();
    await gfs.delete(fileId);
    console.log(`File ${fileId} deleted from GridFS`);
  } catch (error) {
    console.error(`Failed to delete file ${fileId}:`, error);
    throw new FileUploadError('Failed to delete file', 'DELETE_ERROR', fileId);
  }
};

// Get a readable stream for a file from GridFS
const getFileFromGridFS = (fileId) => {
  if (!gfsReady()) {
    throw new Error('GridFS is not initialized');
  }
  
  const gfs = getGfs();
  return gfs.openDownloadStream(fileId);
};

// Get metadata for a file stored in GridFS
const getFileMetadata = async (fileId) => {
  if (!gfsReady()) {
    throw new Error('GridFS is not initialized');
  }
  
  try {
    const gfs = getGfs();
    const files = await gfs.find({ _id: fileId }).toArray();
    return files.length > 0 ? files[0] : null;
  } catch (error) {
    console.error(`Failed to get metadata for file ${fileId}:`, error);
    throw new FileUploadError('Failed to get file metadata', 'METADATA_ERROR', fileId);
  }
};

// Process multiple files upload to GridFS
const processMultipleFiles = async (files, metadata = {}) => {
  const results = [];
  const errors = [];
  
  for (const [fieldname, fileArray] of Object.entries(files)) {
    for (const file of fileArray) {
      try {
        const result = await uploadToGridFS(file, { ...metadata, fieldname });
        results.push({ fieldname, ...result });
      } catch (error) {
        errors.push({ fieldname, error: error.message, filename: file.originalname });
      }
    }
  }
  
  return { successful: results, failed: errors };
};

// Cleanup multiple files from GridFS
const cleanupTempFiles = async (fileIds) => {
  const results = [];
  for (const fileId of fileIds) {
    try {
      await deleteFileFromGridFS(fileId);
      results.push({ fileId, success: true });
    } catch (error) {
      results.push({ fileId, success: false, error: error.message });
    }
  }
  return results;
};

// Helper functions used in GridFS operations
const generateUniqueFilename = (originalName) => {
  const timestamp = Date.now();
  const random = Math.random().toString(36).substring(2);
  const extension = originalName.split('.').pop().toLowerCase();
  return `${timestamp}_${random}.${extension}`;
};

const formatFileSize = (bytes) => {
  if (bytes === 0) return '0 Bytes';
  const k = 1024;
  const sizes = ['Bytes', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
};

export {
  uploadToGridFS,
  deleteFileFromGridFS,
  getFileFromGridFS,
  getFileMetadata,
  processMultipleFiles,
  cleanupTempFiles,
  gfsReady,
  FileUploadError,
  generateUniqueFilename,
  formatFileSize,
  getGfs
};



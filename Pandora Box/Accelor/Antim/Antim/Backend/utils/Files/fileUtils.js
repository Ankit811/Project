// services/fileService.js
import { uploadToGridFS } from '../../middleware/fileUpload.js';
import { getGfs } from '../sauth/gridfs.js';
import { ObjectId } from 'mongodb';

const processEmployeeFiles = async (files, employeeId) => {
  const uploadedFiles = {};
  
  if (!files || Object.keys(files).length === 0) {
    return uploadedFiles;
  }

  for (const field of Object.keys(files)) {
    uploadedFiles[field] = [];
    for (const file of files[field]) {
      const uploadedFile = await uploadToGridFS(file, {
        originalname: file.originalname,
        mimetype: file.mimetype,
        fieldname: file.fieldname,
        employeeId: employeeId || 'unknown',
      });

      uploadedFiles[field].push({
        id: uploadedFile._id,
        filename: uploadedFile.filename,
      });
    }
  }
  
  return uploadedFiles;
};

const deleteFileFromGridFS = async (fileId) => {
  try {
    await getGfs().delete(new ObjectId(fileId));
  } catch (err) {
    console.warn(`Failed to delete file ${fileId}: ${err.message}`);
  }
};

const streamFileFromGridFS = async (fileId, res) => {
  const gfs = getGfs();
  const downloadStream = gfs.openDownloadStream(new ObjectId(fileId));
  
  downloadStream.on('error', (err) => {
    console.error('Error streaming file:', err);
    res.status(404).json({ message: 'File not found' });
  });
  
  downloadStream.pipe(res);
};

const getDocumentMetadata = async (documentIds) => {
  const gfs = getGfs();
  const metadata = [];
  
  for (const docId of documentIds) {
    if (docId) {
      try {
        const files = await gfs.find({ _id: new ObjectId(docId) }).toArray();
        if (files.length > 0) {
          metadata.push({
            id: files[0]._id,
            filename: files[0].filename,
            fieldname: files[0].metadata?.fieldname || 'unknown'
          });
        }
      } catch (err) {
        console.warn(`Failed to get metadata for ${docId}:`, err.message);
      }
    }
  }
  
  return metadata;
};

const extractDocumentIds = (files) => {
  const docFields = [
    'tenthTwelfthDocs', 'graduationDocs', 'postgraduationDocs', 'experienceCertificate',
    'salarySlips', 'panCard', 'aadharCard', 'bankPassbook', 'medicalCertificate',
    'backgroundVerification'
  ];

  return docFields
    .map(field => files[field] && files[field][0] ? files[field][0].id : null)
    .filter(id => id !== null);
};

export  { 
  processEmployeeFiles, 
  deleteFileFromGridFS, 
  streamFileFromGridFS, 
  getDocumentMetadata,
  extractDocumentIds
};

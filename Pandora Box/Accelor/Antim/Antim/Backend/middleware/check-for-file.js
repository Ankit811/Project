// Middleware to check if request contains files
const checkForFiles = (req, res, next) => {
    const contentType = req.headers['content-type'] || '';
    if (contentType.includes('multipart/form-data')) {
      upload.fields([
        { name: 'profilePicture', maxCount: 1 },
        { name: 'tenthTwelfthDocs', maxCount: 1 },
        { name: 'graduationDocs', maxCount: 1 },
        { name: 'postgraduationDocs', maxCount: 1 },
        { name: 'experienceCertificate', maxCount: 1 },
        { name: 'salarySlips', maxCount: 1 },
        { name: 'panCard', maxCount: 1 },
        { name: 'aadharCard', maxCount: 1 },
        { name: 'bankPassbook', maxCount: 1 },
        { name: 'medicalCertificate', maxCount: 1 },
        { name: 'backgroundVerification', maxCount: 1 },
      ])(req, res, async (err) => {
        if (err instanceof MulterError) {
          console.error('Multer error:', err);
          return res.status(400).json({ message: `Multer error: ${err.message}` });
        }
        if (err) {
          console.error('Upload error:', err);
          return res.status(400).json({ message: `Upload error: ${err.message}` });
        }
        // Manually upload files to GridFS
        req.uploadedFiles = {};
        try {
          if (!req.files || Object.keys(req.files).length === 0) {
            return next();
          }
          for (const field of Object.keys(req.files)) {
            req.uploadedFiles[field] = [];
            for (const file of req.files[field]) {
              if (!file.buffer || !file.originalname || !file.mimetype) {
                return res.status(400).json({ message: `Invalid file data for ${field}` });
              }
              const uploadedFile = await uploadToGridFS(file, {
                originalname: file.originalname,
                mimetype: file.mimetype,
                fieldname: file.fieldname,
                employeeId: req.body.employeeId || req.params.id || 'unknown',
              });
              if (!uploadedFile || !uploadedFile._id) {
                return res.status(500).json({ message: `GridFS upload failed for ${file.originalname}` });
              }
              req.uploadedFiles[field].push({
                id: uploadedFile._id,
                filename: uploadedFile.filename,
              });
            }
          }
          next();
        } catch (uploadErr) {
          console.error('GridFS upload error:', uploadErr);
          return res.status(500).json({ message: 'File upload to GridFS failed', error: uploadErr.message });
        }
      });
    } else {
      req.uploadedFiles = {};
      next();
    }
  };

  export default checkForFiles;
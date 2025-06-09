import { Router } from 'express';
const router = Router();
import Employee from '../models/Employee.js';
// In routes/Employee.js
import Department from '../models/department.js';
import { auth } from '../middleware/auth.js';
import role from '../middleware/role.js';
import { createEmployeesFromExcel, readExcelFile } from '../utils/Files/excelutils.js';
import { ensureGFS, ensureDbConnection } from '../middleware/gfs-db-check.js';
import { getDocumentMetadata, processEmployeeFiles, extractDocumentIds, deleteFileFromGridFS, streamFileFromGridFS } from '../utils/Files/fileUtils.js';
import { validateEmployeeData, validateConditionalFields } from '../utils/validationUtils.js';
// import { upload, excelUpload } from '../middleware/fileUpload.js';
import { upload, excelUpload } from '../middleware/fileUpload.js';

import { logEmployeeAction } from '../utils/auditService.js';
import { checkEmployeeUpdatePermission, checkSectionLockPermissions } from '../utils/sauth/authService.js';

// require('dotoenv').config();

// GET /:id/documents - Retrieve document metadata for employee
//WORKS:)
router.get('/:id/documents', auth, ensureGFS, async (req, res) => {
  try {
    const employee = await Employee.findOne({employeeId: req.params.id});
    if (!employee) {
      return res.status(404).json({ message: 'Employee not found' });
    }

    // Fetch document metadata from GridFS
    const documentMetaData = await getDocumentMetadata(employee.documents);
    res.json(documentMetaData);
  } catch (err) {
    console.error('Error fetching document metadata:', err);
    res.status(500).json({ message: 'Server error', error: err.message });
  }
});

// GET / - Retrieve all employees with department and reporting manager populated
// Admin and CEO roles can access this route
// WORKS:)
router.get('/', auth, role(['Admin', 'CEO']), async (req, res) => {
  try {
    console.log('Fetching all employees');
    const employees = await Employee.find()
      .populate('department', 'name')
      .populate('reportingManager', 'name employeeId')
      .lean();
    res.json(employees);
  } catch (err) {
    console.error('Error fetching employees:', err);
    res.status(500).json({ message: 'Server error', error: err.message });
  }
});

// GET /department - get all employees in a specific department
//WORKS:)
router.get('/department', auth, role(['HOD']), async (req, res) => {
  try {
    const user = await Employee.findById(req.user.id).populate('department');
    if (!user || !user.department) {
      return res.status(404).json({ message: 'User department not found' });
    }

    const employees = await Employee.find({ department: user.department._id })
      .populate('department', 'name')
      .populate('reportingManager', 'name employeeId')
      .lean();
    res.json(employees);
  } catch (err) {
    console.error('Error fetching department employees:', err);
    res.status(500).json({ message: 'Server error', error: err.message });
  }
});

// GET /departments - Fetch all departments
//WORKS:)
router.get('/departments', auth, role(['Admin', 'CEO']), async (req, res) => {
  try {
    const departments = await Department.find().select('_id name').populate('HOD', 'name, email, employeeId').lean();
    res.json(departments);
  } catch (err) {
    console.error('Error fetching departments:', err);
    res.status(500).json({ message: 'Server error', error: err.message });
  }
});

// GET /:id - Fetch single employee
//WORKS:) 
router.get('/:id', auth, async (req, res) => {
  try {
    const employee = await Employee.findOne({ employeeId: req.params.id })
      .populate('department', 'name')
      .populate('reportingManager', 'name employeeId')
      .lean();

    if (!employee) {
      return res.status(404).json({ message: 'Employee not found' });
    }
    res.json(employee);
  } catch (err) {
    console.error('Error fetching employee:', err);
    res.status(500).json({ message: 'Server error', error: err.message });
  }
});

// POST / - Create new employee
//WORKS:)
router.post('/new-employee', auth, role(['Admin']), ensureGFS, ensureDbConnection, upload.fields([
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
  { name: 'backgroundVerification', maxCount: 1 }
]), async (req, res) => {
  try {
    // Validate employee data
    console.log('Validating employee data:', req.body);
    const validation = validateEmployeeData(req.body);
    if (!validation.isValid) {
      return res.status(400).json({ message: validation.errors.join(', ') });
    }

    const conditionalValidation = validateConditionalFields(req.body);
    if (!conditionalValidation.isValid) {
      return res.status(400).json({ message: conditionalValidation.errors.join(', ') });
    }

    // Process uploaded files
    const uploadedFiles = await processEmployeeFiles(req.files);

    // Create employee
    const employee = new Employee({
      ...req.body,
      profilePicture: uploadedFiles.profilePicture?.[0]?.id || null,
      documents: extractDocumentIds(uploadedFiles),
      locked: true,
      basicInfoLocked: true,
      positionLocked: true,
      statutoryLocked: true,
      documentsLocked: true,
      paymentLocked: true,
    });

    const newEmployee = await employee.save();

    // Log action
    await logEmployeeAction('create_employee', newEmployee.employeeId, req.user?.employeeId);

    res.status(201).json(newEmployee);
  } catch (err) {
    console.error('Error creating employee:', err);
    res.status(500).json({ message: 'Server error', error: err.message });
  }
});

//Put /:id - Update existing employee
// PUT /:id - Update employee
//WORKS:)
router.put('/:id/update', auth, ensureGFS, ensureDbConnection, upload.fields([
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
  { name: 'backgroundVerification', maxCount: 1 }
]), async (req, res) => {
  try {
    const employeeId = req.params.id.trim();
    console.log('Updating employee with ID:', employeeId);

    const employee = await Employee.findOne({ employeeId: employeeId });
    if (!employee) {
      return res.status(404).json({ message: 'Employee not found' });
    }
    // Check permissions
    if (!checkEmployeeUpdatePermission(req.user, employee)) {
      return res.status(403).json({ message: 'Unauthorized to update this employee' });
    }

    // Check section locks
    const lockCheck = checkSectionLockPermissions(employee, req.body, req.files, req.user.role);
    if (!lockCheck.canUpdate) {
      return res.status(403).json({
        message: `Cannot update locked sections: ${lockCheck.unauthorizedFields.join(', ')}`
      });
    }

    // Process new files if uploaded
    if (req.files && Object.keys(req.files).length > 0) {
      const uploadedFiles = await processEmployeeFiles(req.files);

      // Delete old files and update with new ones
      for (const [field, files] of Object.entries(uploadedFiles)) {
        if (files.length > 0) {
          // Delete old file if exists
          if (employee.documents[field]) {
            await deleteFileFromGridFS(employee[field]);
          }
          employee[field] = files[0].id;
        }
      }
    }

    // Update employee data
    Object.assign(employee, req.body);
    const updatedEmployee = await employee.save();

    // w action
    await logEmployeeAction('update_employee', employee.employeeId, req.user?.employeeId);

    res.json(updatedEmployee);
  } catch (err) {
    console.error('Error updating employee:', err);
    res.status(500).json({ message: 'Server error', error: err.message });
  }
});

// DELETE /:id - Delete employee
//WORKS:)
router.delete('/:id/delete', auth, role(['Admin']), ensureGFS, async (req, res) => {
  try {
    const employeeId = req.params.id.trim();
    console.log('Deleting employee with ID:', employeeId);

    const employee = await Employee.findOne({ employeeId: employeeId });
    if (!employee) {
      return res.status(404).json({ message: 'Employee not found' });
    }

    // Delete profile picture
    if (employee.profilePicture) {
      await deleteFileFromGridFS(employee.profilePicture);
    }

    // Delete all documents
    if (employee.documents && employee.documents.length > 0) {
      for (const docId of employee.documents) {
        await deleteFileFromGridFS(docId);
      }
    }

    // Delete employee record
    // ✅ Correct - line 248
    const employee_d = await Employee.findOneAndDelete({ employeeId: req.params.id });

    // Log action
    await logEmployeeAction('delete_employee', employee_d.employeeId, req.user?.employeeId);

    res.json({ message: 'Employee deleted successfully' });
  } catch (err) {
    console.error('Error deleting employee:', err);
    res.status(500).json({ message: 'Server error', error: err.message });
  }
});


// GET /files/:fileId - Stream file from GridFS
router.get('/files/:fileId', auth, ensureGFS, async (req, res) => {
  try {
    await streamFileFromGridFS(req.params.fileId, res);
  } catch (err) {
    console.error('Error streaming file:', err);
    res.status(404).json({ message: 'File not found' });
  }
});

// PATCH /:id/lock - Toggle employee lock
//WORKS:)
router.patch('/:id/lock', auth, role(['Admin']), async (req, res) => {
  try {
    const employeeId = req.params.id.trim();
    const employee = await Employee.findOne({ employeeId: employeeId });    
    if (!employee) {
      return res.status(404).json({ message: 'Employee not found' });
    }

    employee.locked = !employee.locked;
    await employee.save();

    // Log action
    await logEmployeeAction('toggle_lock', employee.employeeId, req.user?.id, { locked: employee.locked });

    res.json({ message: `Employee ${employee.locked ? 'locked' : 'unlocked'} successfully`, locked: employee.locked });
  } catch (err) {
    console.error('Error toggling employee lock:', err);
    res.status(500).json({ message: 'Server error', error: err.message });
  }
});

// PATCH /:id/lock-section - Toggle section locks
// WORKS:)
router.patch('/:id/lock-section', auth, role(['Admin']), async (req, res) => {
  try {
    const { section } = req.body;
    const validSections = ['basicInfo', 'position', 'statutory', 'documents', 'payment'];

    if (!validSections.includes(section)) {
      return res.status(400).json({ message: 'Invalid section' });
    }

    const employeeId = req.params.id.trim();
    const employee = await Employee.findOne({ employeeId: employeeId });    if (!employee) {
      return res.status(404).json({ message: 'Employee not found' });
    }

    const lockField = `${section}Locked`;
    employee[lockField] = !employee[lockField];
    await employee.save();

    // Log action
    await logEmployeeAction('toggle_section_lock', employee.employeeId, req.user?.id, {
      section,
      locked: employee[lockField]
    });

    res.json({
      message: `${section} section ${employee[lockField] ? 'locked' : 'unlocked'} successfully`,
      [lockField]: employee[lockField]
    });
  } catch (err) {
    console.error('Error toggling section lock:', err);
    res.status(500).json({ message: 'Server error', error: err.message });
  }
});

// POST /upload-excel - Bulk employee creation via Excel
router.post('/upload-excel', auth, role(['Admin']), excelUpload.single('excel'), async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ message: 'No file uploaded.' });
    }

    // Process Excel file
    const rows = readExcelFile(req.file.buffer);
    const results = await createEmployeesFromExcel(rows);

    const successful = results.filter(r => r.success);
    const failed = results.filter(r => !r.success);

    // Log bulk action
    await logEmployeeAction('bulk_create_employees', null, req.user?.id, {
      totalProcessed: results.length,
      successful: successful.length,
      failed: failed.length
    });

    res.json({
      message: `Processed ${results.length} employees. ${successful.length} successful, ${failed.length} failed.`,
      successful: successful.map(r => r.employee),
      failed: failed.map(r => ({ error: r.error, row: r.row }))
    });
  } catch (err) {
    console.error('Error processing Excel upload:', err);
    res.status(500).json({ message: 'Server error', error: err.message });
  }
});

//WORKS:)
router.patch('/:id/reset-password', auth, role(['Admin']), async (req, res) => {
  try {
    const { newPassword } = req.body;
    const employeeId = req.params.id.trim();
    const employee = await Employee.findOne({ employeeId: employeeId });
    if (!employee) {
      return res.status(404).json({ message: 'Employee not found' });
    }

    // Set new password (will be hashed automatically)
    employee.password = newPassword;
    await employee.save();

    res.json({ message: 'Password reset successfully' });
  } catch (error) {
    res.status(500).json({ message: 'Server error' });
  }
});


export default router;

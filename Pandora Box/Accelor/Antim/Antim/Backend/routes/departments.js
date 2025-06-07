import express from 'express';
import Department from '../models/department.js';
import Employee from '../models/Employee.js';
import { auth } from '../middleware/auth.js';
import role from '../middleware/role.js';
import { logEmployeeAction } from '../utils/auditService.js';


const router = express.Router();

const updateEmployeeRole = async (_id, newRole) => {
  try{
    await Employee.findByIdAndUpdate(_id, { loginType: newRole});
  console.log(`Updated employee role for ${_id} to ${newRole}`);
} catch (err) {
    console.error(`Error updating employee role for ${_id}:`, err);
    throw new Error('Failed to update employee role');
  }
}

// Get departments based on user role
router.get('/', auth, async (req, res) => {
  try {
    let departments;
    if (req.user.loginType === 'HOD') {
      // Fetch the HOD's department
      const hod = await Employee.findById(req.user.id).populate('department');
      if (!hod || !hod.department) {
        return res.status(400).json({ message: 'HOD has no valid department assigned' });
      }
      departments = [hod.department]; // Return as array for consistency
    } else if (['Admin', 'CEO'].includes(req.user.loginType)) {
      // Admin and CEO can fetch all departments
      departments = await Department.find();
    } else {
      return res.status(403).json({ message: 'Forbidden: Insufficient role' });
    }
    res.json(departments);
  } catch (err) {
    console.error('Error fetching departments:', err);
    res.status(500).json({ message: 'Server error' });
  }
});

// POST METHOD ASSIGNING HOD NAME TO OBJECTID AND EMPLOYEE LOGINTYPE NOT CHANGED
// POST / - Create a department (Admin only)
router.post('/new', auth, role(['Admin']), async (req, res) => {
  try {
    const { name, HOD } = req.body;
    if (!name || !name.trim()) {
      return res.status(400).json({ message: ' Department name is required' });
    }
    const trimmedName = name.trim();
    // Check if department already exists
    const existingDepartment = await Department.findOne({ name: trimmedName });
    if (existingDepartment) {
      return res.status(400).json({ message: 'Department already exists' });
    }
    let hodObjectId = null
    // Validate HOD if provided
    if (HOD && HOD.trim()) {
      const hodEmployeeId = HOD.trim();
      const hodEmployee = await Employee.findOne({ employeeId: hodEmployeeId });
      if (!hodEmployee) {
        return res.status(400).json({ message: 'Invalid HOD: Employee not found' });
      }
      console.log('HOD Employee found:', hodEmployee.name);
      const existingHOD = await Department.findOne({ HOD: hodEmployee._id });
      if (existingHOD) {
        return res.status(400).json({
          message: `Employee is already HOD of ${existingHOD.name} department`
        });
      }
      console.log('HOD is valid and not already assigned to another department');
      hodObjectId = hodEmployee._id;
      await updateEmployeeRole(hodObjectId, 'HOD'); 
    }
    console.log('Creating department:', trimmedName, 'with HOD:', hodObjectId);
    // Create department with ObjectId for HOD
    const department = new Department({
      name: trimmedName,
      HOD: hodObjectId // This is now an ObjectId or null
    });

    await department.save();

    // Populate HOD details for response
    await department.populate('HOD', 'name employeeId email loginType');

    // Log action
    await logEmployeeAction('create_department', department.name, req.user?.employeeId);

    res.status(201).json({
      message: 'Department created successfully',
      department
    });
    console.log('Successfully created department:', department.name);

  } catch (err) {
    console.error('Error creating department:', err);

    if (err.code === 11000) {
      return res.status(400).json({ message: 'Department with this name already exists' });
    }

    res.status(500).json({ message: 'Server error', error: err.message });
  }
});

// PUT /:name - Update a department by name (Admin only)
//WORKS:)
router.put('/update/:name', auth, role(['Admin']), async (req, res) => {
  try {
    const departmentName = req.params.name.trim();
    const { name: newName, HOD } = req.body;

    const department = await Department.findOne({ name: departmentName });
    if (!department) {
      return res.status(404).json({ message: 'Department not found' });
    }

    // Store old values for logging
    const oldName = department.name;
    const oldHOD = department.HOD;

    // Validate new name if provided
    if (newName !== undefined) {
      if (!newName || !newName.trim()) {
        return res.status(400).json({ message: 'Department name cannot be empty' });
      }

      // Check for duplicate name (excluding current department)
      const existingDepartment = await Department.findOne({
        name: newName.trim(),
        _id: { $ne: department._id }
      });
      if (existingDepartment) {
        return res.status(400).json({ message: 'Department with this name already exists' });
      }

      department.name = newName.trim();
    }

    // Handle HOD updates
    if (HOD !== undefined) {
      if (HOD === null || HOD === '') {
        // Remove HOD
        if (department.HOD) {
          const previousHOD = await Employee.findById(department.HOD);
          department.HOD = null;
          if (previousHOD) {
            await updateEmployeeRole(previousHOD._id, 'Employee'); // Reset HOD role to Employee
          }
          // Log HOD removal
          await logEmployeeAction(
            'remove_hod',
            `${previousHOD?.name || 'Unknown'} removed as HOD of ${department.name}`,
            req.user?.employeeId
          );
        }
      } else {
        // Assign new HOD
        const hodEmployee = await Employee.findOne({employeeId: HOD.trim()});
        if (!hodEmployee) {
          return res.status(400).json({ message: 'Invalid HOD: Employee not found' });
        }

        // Check if employee is already HOD of another department
        const existingHOD = await Department.findOne({
          HOD: hodEmployee._id,
          _id: { $ne: department._id }
        });
        if (existingHOD) {
          return res.status(400).json({
            message: `Employee is already HOD of ${existingHOD.name} department`
          });
        }

          // Check if this is actually a change
          if (!oldHOD || oldHOD.toString() !== hodEmployee._id.toString()) {
            // Log HOD change
            if (oldHOD) {
              const previousHOD = await Employee.findById(oldHOD);
              // Log the change of HOD
             
              await logEmployeeAction(
                'change_hod', 
                `${previousHOD?.name || 'Unknown'} replaced by ${hodEmployee.name} as HOD of ${department.name}`, 
                req.user?.employeeId
              );
            } else {
              await logEmployeeAction(
                'assign_hod', 
                `${hodEmployee.name} assigned as HOD of ${department.name}`, 
                req.user?.employeeId
              );
            }
            
          }
          if (oldHOD) {
            const previousHOD = await Employee.findById(oldHOD);
            if (previousHOD) {
              await updateEmployeeRole(previousHOD._id, 'Employee');
            }
          }
          await updateEmployeeRole(hodEmployee._id, 'HOD');

        department.HOD = hodEmployee._id; // Assign ObjectId of HOD
      }
    }

    // Save changes
    await department.save();

    // Populate HOD details for response
    await department.populate('HOD', 'name employeeId email loginType');

    // Log department update if name changed
      if (newName && oldName !== newName) {
        await logEmployeeAction(
          'update_department_name', 
          `Department renamed from ${oldName} to ${newName}`, 
          req.user?.employeeId
        );
      }

    // General update log
    await logEmployeeAction('update_department', department.name, req.user?.employeeId);
    const hodswap = (() =>{
      if (HOD === undefined) return false;
  
  // Convert both to strings for comparison, handling null/undefined
  const oldHODString = oldHOD ? oldHOD.toString() : null;
  const newHODString = department.HOD ? department.HOD.toString() : null;
  
  return oldHODString !== newHODString;
    })
    res.json({
      message: 'Department updated successfully',
      department,
      changes: {
        nameChanged: oldName !== department.name,
        hodChanged: hodswap(),
        previousName: oldName,
        previousHOD: oldHOD
      }
    });
  } catch (err) {
    console.error('Error updating department:', err);
    res.status(500).json({ message: 'Server error', error: err.message });
  }
});


//Delete a department (Admin only)
//Works:)
router.delete('/delete/:name', auth, role(['Admin']), async (req, res) => {
  try {
    const departmentName = req.params.name.trim();
    const department = await Department.findOne({ name: departmentName });
    if (!department){
      return res.status(404).json({ message: 'Department not found' });
    }
    const employee = await Employee.find ({ department: department._id });
    if (employee.length > 0) {
      return res.status(400).json({ message: 'Cannot delete department with assigned employees' });
    }
    await Department.deleteOne({ _id: department._id });
    await logEmployeeAction('delete_department', department.name, req.user?.employeeId);
    await updateEmployeeRole(department.HOD, 'Employee'); // Reset HOD role to Employee
    res.json({ message: 'Department Deleted Successfully' });
  }catch (err) {
    console.error('Error deleting department:', err);
    res.status(500).json({ message: 'Server error', error: err.message });
  }
});

export default router;
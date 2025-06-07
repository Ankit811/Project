// routes/attendance.js
import { Router } from 'express';
const router = Router();
import {auth} from '../middleware/auth.js';
import Employee from '../models/Employee.js';
const find = Employee.find.bind(Employee); // Bind the find method to Employee model
// Import extracted services
import { getAttendanceFilter } from '../utils/sauth/authService.js';
import { getAttendanceRecords, getEmployeeDepartmentMapping, getApprovedLeaves } from '../utils/Attendance/attendanceUtils.js';
import { transformAttendanceData, generateExcelBuffer, createLeaveMapping, createODMapping, getApprovedODs  } from '../utils/Files/excelUtils.js';

// GET /api/attendance - Fetch attendance records
router.get('/', auth, async (req, res) => {
  try {
    // Get role-based filter using extracted service
    console.log('1 - Fetching attendance records with user:', req.user);
    const authFilter = await getAttendanceFilter(req.user);
    console.log('2 - Auth filter:', authFilter);
    // Build query filter with validation
    let queryFilter = {};
    
    // Validate and process employeeId
    if (req.query.employeeId) {
      if (typeof req.query.employeeId !== 'string' || req.query.employeeId.trim() === '') {
        return res.status(400).json({ message: 'Invalid employeeId parameter' });
      }
      queryFilter.employeeId = req.query.employeeId.trim();
    }
    console.log('3 - Query filter after employeeId:', queryFilter);
    // Validate and process departmentId
    if (req.query.departmentId) {
      if (typeof req.query.departmentId !== 'string' || req.query.departmentId.trim() === '') {
        return res.status(400).json({ message: 'Invalid departmentId parameter' });
      }
      
      const employees = await find({ 
        department: req.query.departmentId.trim() 
      }).select('employeeId');
      
      if (employees.length === 0) {
        return res.status(404).json({ message: 'No employees found in specified department' });
      }
      
      queryFilter.employeeId = { $in: employees.map(e => e.employeeId) };
    }
    console.log('4 - Query filter after departmentId:', queryFilter);
    // Validate and process date range
    if (req.query.fromDate && req.query.toDate) {
      const fromDate = new Date(req.query.fromDate);
      const toDate = new Date(req.query.toDate);
      
      if (isNaN(fromDate.getTime()) || isNaN(toDate.getTime())) {
        return res.status(400).json({ message: 'Invalid date format. Use YYYY-MM-DD' });
      }
      
      if (fromDate > toDate) {
        return res.status(400).json({ message: 'fromDate cannot be later than toDate' });
      }
      
      queryFilter.logDate = {
        $gte: new Date(`${req.query.fromDate}T00:00:00.000Z`),
        $lte: new Date(`${req.query.toDate}T23:59:59.999Z`)
      };
    }
    console.log('5 - Query filter after date range:', queryFilter);
    // Combine filters
    const combinedFilter = { ...authFilter, ...queryFilter };
    console.log('6 - Combined filter:', combinedFilter);
    // Fetch attendance records using extracted service
    const attendance = await getAttendanceRecords(combinedFilter);
    console.log('7 - Attendance records fetched:', attendance.length);
    res.json(attendance);
    
  } catch (error) {
    console.error('Error fetching attendance:', error);
    
    // Handle specific error types
    if (error.name === 'CastError') {
      return res.status(400).json({ message: 'Invalid data format in request' });
    }
    
    if (error.name === 'ValidationError') {
      return res.status(400).json({ message: 'Validation error: ' + error.message });
    }
    
    res.status(500).json({ message: 'Internal server error' });
  }
});

// GET /api/attendance/download - Download attendance as Excel
router.get('/download', auth, async (req, res) => {
  try {
    // Get role-based filter using extracted service
    const authFilter = await getAttendanceFilter(req.user);
    
    // Build query filter with validation
    let queryFilter = {};
    
    // Validate and process employeeId
    if (req.query.employeeId) {
      if (typeof req.query.employeeId !== 'string' || req.query.employeeId.trim() === '') {
        return res.status(400).json({ message: 'Invalid employeeId parameter' });
      }
      queryFilter.employeeId = req.query.employeeId.trim();
    }
    
    // Validate and process departmentId
    if (req.query.departmentId) {
      if (typeof req.query.departmentId !== 'string' || req.query.departmentId.trim() === '') {
        return res.status(400).json({ message: 'Invalid departmentId parameter' });
      }
      
      const employees = await find({ 
        department: req.query.departmentId.trim() 
      }).select('employeeId');
      
      if (employees.length === 0) {
        return res.status(404).json({ message: 'No employees found in specified department' });
      }
      
      queryFilter.employeeId = { $in: employees.map(e => e.employeeId) };
    }
    
    // Validate and process date range
    if (req.query.fromDate && req.query.toDate) {
      const fromDate = new Date(req.query.fromDate);
      const toDate = new Date(req.query.toDate);
      
      if (isNaN(fromDate.getTime()) || isNaN(toDate.getTime())) {
        return res.status(400).json({ message: 'Invalid date format. Use YYYY-MM-DD' });
      }
      
      if (fromDate > toDate) {
        return res.status(400).json({ message: 'fromDate cannot be later than toDate' });
      }
      
      queryFilter.logDate = {
        $gte: new Date(`${req.query.fromDate}T00:00:00.000Z`),
        $lte: new Date(`${req.query.toDate}T23:59:59.999Z`)
      };
    }
    
    // Validate status parameter
    if (req.query.status) {
      const validStatuses = ['Present', 'Absent', 'Half Day - First Half', 'Half Day - Second Half', 'Late'];
      if (!validStatuses.includes(req.query.status)) {
        return res.status(400).json({ 
          message: 'Invalid status. Valid options: ' + validStatuses.join(', ') 
        });
      }
      queryFilter.status = req.query.status;
    }
    
    // Combine filters
    const combinedFilter = { ...authFilter, ...queryFilter };
    
    // Fetch data using extracted services
    const attendance = await getAttendanceRecords(combinedFilter);
    
    if (attendance.length === 0) {
      return res.status(404).json({ message: 'No attendance records found for the specified criteria' });
    }
    
    // Get employee department mapping
    const employeeIds = [...new Set(attendance.map(record => record.employeeId))];
    const employeeMap = await getEmployeeDepartmentMapping(employeeIds);
    
    // Get leave data if date filter exists
    let leaveMap = {};
    let odMap = {};
    if (queryFilter.logDate) {
      const leaves = await getApprovedLeaves(queryFilter.logDate);
      leaveMap = createLeaveMapping(leaves);

      const ods = await getApprovedODs(employeeIds, queryFilter.logDate.$gte, queryFilter.logDate.$lte);
  odMap = createODMapping(ods);
    }
    
    // Transform data and generate Excel using extracted services
    const transformedData = transformAttendanceData(attendance, employeeMap, leaveMap, odMap);
    const buffer = generateExcelBuffer(transformedData);
    
    // Validate filename parameters for security
    const status = req.query.status ? req.query.status.replace(/[^a-zA-Z0-9]/g, '_') : 'all';
    const fromDate = req.query.fromDate ? req.query.fromDate.replace(/[^0-9-]/g, '') : 'all_dates';
    
    // Set response headers and send file
    res.setHeader('Content-Disposition', `attachment; filename=attendance_${status}_${fromDate}.xlsx`);
    res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
    res.send(buffer);
    
  } catch (error) {
    console.error('Error generating attendance report:', error);
    
    // Handle specific error types
    if (error.name === 'CastError') {
      return res.status(400).json({ message: 'Invalid data format in request' });
    }
    
    if (error.name === 'ValidationError') {
      return res.status(400).json({ message: 'Validation error: ' + error.message });
    }
    
    if (error.message.includes('XLSX')) {
      return res.status(500).json({ message: 'Error generating Excel file' });
    }
    
    res.status(500).json({ message: 'Internal server error' });
  }
});

export default router;

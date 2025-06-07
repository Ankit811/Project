import ExcelJS from 'exceljs';
import Employee from '../../models/Employee.js';
import Department from '../../models/Department.js';
import { validateField } from '../validationUtils.js';
import OD from '../../models/OD.js';

const parseExcelDate = (value) => {
    if (!value) return undefined;
    if (typeof value === 'number') {
        return new Date(Math.round((value - 25569) * 86400 * 1000));
    }
    return new Date(value);
};

const formatDate = (date) => {
    return date ? date.toISOString().split('T')[0] : null;
};

// READ EMPLOYEE DATA
const readExcelFile = async (buffer) => {
    const workbook = new ExcelJS.Workbook();
    await workbook.xlsx.load(buffer);
    const worksheet = workbook.worksheets[0];
    const rows = [];

    const headerRow = worksheet.getRow(1).values.slice(1);
    worksheet.eachRow((row, rowNumber) => {
        if (rowNumber === 1) return;
        const rowData = {};
        row.values.slice(1).forEach((cell, colIndex) => {
            const key = headerRow[colIndex];
            rowData[key] = cell;
        });
        rows.push(rowData);
    });

    return rows;
};

const validateExcelRow = (row) => {
    const errors = [];
    const fieldsToValidate = [
        'aadharNumber', 'mobileNumber', 'email',
        'panNumber', 'pfNumber', 'uanNumber',
        'esiNumber', 'bloodGroup',
    ];

    fieldsToValidate.forEach(field => {
        if (row[field]) {
            const validation = validateField(field.replace('Number', ''), row[field]);
            if (!validation.isValid) {
                errors.push(validation.message);
            }
        }
    });

    if (row.status === 'Resigned' && !row.dateOfResigning) {
        errors.push('Date of Resigning is required for Resigned status');
    }

    if (row.status === 'Working' && !row.employeeType) {
        errors.push('Employee Type is required for Working status');
    }

    return { isValid: errors.length === 0, errors };
};

// MODIFIED: Add OD mapping creation
const createODMapping = (ods) => {
    const odMap = {};
    ods.forEach(od => {
      const start = new Date(od.dateOut);
      const end = new Date(od.dateIn);
      for (let d = new Date(start); d <= end; d.setDate(d.getDate() + 1)) {
        const dateKey = d.toISOString().split('T')[0];
        if (!odMap[od.employeeId]) odMap[od.employeeId] = {};
        odMap[od.employeeId][dateKey] = '(OD)';
      }
    });
    return odMap;
  };

  // NEW: Add OD fetching utility
const getApprovedODs = async (employeeIds, fromDate, toDate) => {
    return OD.find({
      employeeId: { $in: employeeIds },
      dateOut: { $lte: toDate },
      dateIn: { $gte: fromDate },
      'status.ceo': 'Approved'
    }).lean();
  };

const transformExcelRowToEmployee = (row, departmentId, reportingManagerId) => ({
    employeeId: row.employeeId || '',
    userId: row.userId || '',
    name: row.name || '',
    dateOfBirth: parseExcelDate(row.dateOfBirth),
    fatherName: row.fatherName || '',
    motherName: row.motherName || '',
    mobileNumber: row.mobileNumber || '',
    permanentAddress: row.permanentAddress || '',
    currentAddress: row.currentAddress || '',
    email: row.email || '',
    password: row.password || Math.random().toString(36).slice(-8),
    aadharNumber: row.aadharNumber || '',
    bloodGroup: row.bloodGroup || '',
    gender: row.gender || '',
    maritalStatus: row.maritalStatus || '',
    spouseName: row.spouseName || '',
    emergencyContactName: row.emergencyContactName || '',
    emergencyContactNumber: row.emergencyContactNumber || '',
    dateOfJoining: parseExcelDate(row.dateOfJoining),
    dateOfResigning: row.status === 'Resigned' ? parseExcelDate(row.dateOfResigning) : null,
    employeeType: row.status === 'Working' ? row.employeeType : null,
    probationPeriod: row.status === 'Working' && row.employeeType === 'Probation' ? row.probationPeriod : null,
    confirmationDate: row.status === 'Working' && row.employeeType === 'Probation' ? parseExcelDate(row.dateOfConfirmationDate) : null,
    reportingManager: reportingManagerId,
    status: row.status || '',
    referredBy: row.referredBy || '',
    loginType: row.loginType || '',
    designation: row.designation || '',
    location: row.location || '',
    department: departmentId,
    panNumber: row.panNumber || '',
    pfNumber: row.pfNumber || '',
    uanNumber: row.uanNumber || '',
    esiNumber: row.esiNumber || '',
    paymentType: row.paymentType || '',
    bankDetails: row.paymentType === 'Bank Transfer' ? {
        bankName: row.bankName || '',
        bankBranch: row.bankBranch || '',
        accountNumber: row.accountNumber || '',
        ifscCode: row.ifscCode || '',
    } : null,
    locked: true,
    basicInfoLocked: true,
    positionLocked: true,
    statutoryLocked: true,
    documentsLocked: true,
    paymentLocked: true,
});

const createEmployeesFromExcel = async (rows) => {
    const results = await Promise.all(
        rows.map(async (row) => {
            const { isValid, errors } = validateExcelRow(row);
            if (!isValid) return { success: false, errors, row };

            let departmentId = null;
            if (row.department) {
                const department = await Department.findOne({ name: row.department });
                if (!department) {
                    return { success: false, error: `Department '${row.department}' not found`, row };
                }
                departmentId = department._id;
            }

            let reportingManagerId = null;
            if (row.reportingManager) {
                const manager = await Employee.findOne({ employeeId: row.reportingManager });
                if (!manager) {
                    return { success: false, error: `Reporting manager with employeeId '${row.reportingManager}' not found`, row };
                }
                reportingManagerId = manager._id;
            }

            const employeeData = transformExcelRowToEmployee(row, departmentId, reportingManagerId);
            const employee = new Employee(employeeData);
            const saved = await employee.save();

            return { success: true, employee: saved };
        })
    );

    return results;
};

const transformAttendanceData = (attendance, employeeMap, leaveMap, odMap) => {
    return attendance.map((record, index) => {
        const dateStr = new Date(record.logDate).toISOString().split('T')[0];
        const leaveStatus = leaveMap[record.employeeId]?.[dateStr] || (record.status === 'Absent' ? '(A)' : '');
        const odStatus = odMap[record.employeeId]?.[dateStr] || '';
        const status = leaveStatus || odStatus || (record.status === 'Absent' ? '(A)' : '');
        return {
            serialNumber: index + 1,
            name: record.name,
            department: employeeMap[record.employeeId] || 'Unknown',
            date: `${dateStr} ${status}`,
            timeIn: record.timeIn || '-',
            timeOut: record.timeOut || '-',
            status: record.status + (record.halfDay ? ` (${record.halfDay})` : ''),
            ot: record.ot ? `${Math.floor(record.ot / 60)}:${(record.ot % 60).toString().padStart(2, '0')}` : '00:00',
        };
    });
};

const generateExcelBuffer = async (data) => {
    const workbook = new ExcelJS.Workbook();
    const worksheet = workbook.addWorksheet('Attendance');

    worksheet.getRow(1).font = { bold: true };
    worksheet.getRow(1).alignment = { vertical: 'middle', horizontal: 'center' };

    worksheet.columns = [
        { header: 'Serial Number', key: 'serialNumber', width: 15 },
        { header: 'Name of Employee', key: 'name', width: 25 },
        { header: 'Department', key: 'department', width: 20 },
        { header: 'Date', key: 'date', width: 20 },
        { header: 'Time In', key: 'timeIn', width: 10 },
        { header: 'Time Out', key: 'timeOut', width: 10 },
        { header: 'Status', key: 'status', width: 20 },
        { header: 'OT', key: 'ot', width: 10 },
    ];

    data.forEach(row => worksheet.addRow(row));

    return await workbook.xlsx.writeBuffer();
};

const createLeaveMapping = (leaves) => {
    const leaveMap = {};
    leaves.forEach(leave => {
        if (!leaveMap[leave.employeeId]) leaveMap[leave.employeeId] = {};

        leave.fullDay?.forEach(dateStr => {
            leaveMap[leave.employeeId][dateStr] = '(L)';
        });

        leave.halfDay?.forEach(dateStr => {
            leaveMap[leave.employeeId][dateStr] = '(H)';
        });
    });
    return leaveMap;
};

export {
    readExcelFile,
    validateExcelRow,
    transformExcelRowToEmployee,
    transformAttendanceData,
    generateExcelBuffer,
    createLeaveMapping,
    createEmployeesFromExcel,
    parseExcelDate,
    createODMapping,
    formatDate,
    getApprovedODs
};

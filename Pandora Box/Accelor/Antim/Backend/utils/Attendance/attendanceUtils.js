// utils/attendanceUtils.js
import Attendance from '../../models/Attendance.js';
import RawPunchLog from '../../models/RawPunchLog.js';
import Leave from '../../models/Leave.js';
import Employee from '../../models/Employee.js';
import { WORK_DURATION_THRESHOLD, HALF_DAY_THRESHOLD, AFTERNOON_START } from '../../config/constants.js';

const markAbsentEmployees = async (today) => {
  const employees = await Employee.find();
  const todayPunches = await RawPunchLog.find({ LogDate: today });
  const punchedUserIDs = new Set(todayPunches.map(p => p.UserID));

  for (const employee of employees) {
    if (punchedUserIDs.has(employee.userId)) continue;

    const leave = await getApprovedLeave(employee.employeeId, today);

    const exists = await Attendance.findOne({
      employeeId: employee.employeeId,
      logDate: today,
    });

    if (!exists) {
      await Attendance.create({
        employeeId: employee.employeeId,
        userId: employee.userId,
        name: employee.name,
        logDate: today,
        status: 'Absent',
        timeIn: null,
        timeOut: null,
        halfDay: null,
        ot: 0,
      });
    }
  }
};

const updateTimeOutForYesterday = async (yesterday) => {
  const punches = await RawPunchLog.find({ LogDate: yesterday });
  const grouped = punches.reduce((acc, log) => {
    if (!acc[log.UserID]) acc[log.UserID] = [];
    acc[log.UserID].push(log);
    return acc;
  }, {});

  for (const userId in grouped) {
    const logs = grouped[userId].sort((a, b) => a.LogTime.localeCompare(b.LogTime));
    const employee = await Employee.findOne({ userId });
    if (!employee) continue;

    const attendance = await Attendance.findOne({ employeeId: employee.employeeId, logDate: yesterday });
    if (!attendance || attendance.timeOut) continue;

    const firstPunch = logs[0];
    const lastPunch = logs[logs.length - 1];
    let status = 'Present';
    let halfDay = null;

    const duration = calculateDuration(firstPunch.LogTime, lastPunch.LogTime);
    if (duration < HALF_DAY_THRESHOLD) {
      status = 'Half Day';
      halfDay = 'First Half';
    }

    const ot = Math.max(0, duration - WORK_DURATION_THRESHOLD);

    const leave = await getApprovedLeave(employee.employeeId, yesterday, 'halfDay');

    if (leave) {
      if (leave.halfDay.session === 'forenoon') {
        const afternoonPunch = logs.find(log => log.LogTime >= AFTERNOON_START);
        if (afternoonPunch) {
          status = 'Half Day';
          halfDay = 'Second Half';
        } else {
          status = 'Absent';
        }
      } else if (leave.halfDay.session === 'afternoon') {
        const morningPunch = logs.find(log => log.LogTime < AFTERNOON_START);
        if (!morningPunch) status = 'Absent';
      }
    }

    attendance.timeOut = lastPunch.LogTime;
    attendance.status = status;
    attendance.halfDay = halfDay;
    attendance.ot = ot;
    await attendance.save();
  }
};

const calculateDuration = (start, end) => {
  const [sh, sm] = start.split(':').map(Number);
  const [eh, em] = end.split(':').map(Number);
  return (eh * 60 + em) - (sh * 60 + sm);
};

const getApprovedLeave = async (employeeId, date, type = 'any') => {
  const query = {
    employeeId,
    'status.ceo': 'Approved'
  };

  if (type === 'any') {
    query.$or = [
      { 'fullDay.from': { $lte: date }, 'fullDay.to': { $gte: date } },
      { 'halfDay.date': date }
    ];
  } else if (type === 'halfDay') {
    query['halfDay.date'] = date;
  }

  return await Leave.findOne(query);
};


const getAttendanceRecords = async (filter) => {
  return await Attendance.find(filter).lean();
};

const getEmployeeDepartmentMapping = async (employeeIds) => {
  const employees = await Employee.find({ employeeId: { $in: employeeIds } })
    .populate('department')
    .lean();

  return employees.reduce((map, emp) => {
    map[emp.employeeId] = emp.department?.name || 'Unknown';
    return map;
  }, {});
};

const getApprovedLeaves = async (dateFilter) => {
  return await Leave.find({
    $or: [
      { 'fullDay.from': { $gte: dateFilter.$gte, $lte: dateFilter.$lte } },
      { 'halfDay.date': { $gte: dateFilter.$gte, $lte: dateFilter.$lte } },
    ],
    'status.ceo': 'Approved',
  }).lean();
};

/**
* Build attendance data for daily, monthly, or yearly view.
* @param {Array} attendanceRecords
* @param {string} attendanceView
* @param {Date} fromDate
* @param {Date} toDate
* @returns {Array}
*/
function buildAttendanceData(attendanceRecords, attendanceView, fromDate, toDate) {
  const today = new Date();
  const attendanceData = [];

  if (attendanceView === 'daily') {
    const date = new Date(fromDate);
    const count = attendanceRecords.filter(
      a => new Date(a.logDate).toDateString() === date.toDateString()
    ).length;
    attendanceData.push({ name: date.toLocaleDateString(), count });
  } else if (attendanceView === 'monthly') {
    const daysInMonth = new Date(today.getFullYear(), today.getMonth() + 1, 0).getDate();
    for (let i = 1; i <= daysInMonth; i++) {
      const date = new Date(today.getFullYear(), today.getMonth(), i);
      const count = attendanceRecords.filter(
        a => new Date(a.logDate).toDateString() === date.toDateString()
      ).length;
      attendanceData.push({ name: `${i}`, count });
    }
  } else if (attendanceView === 'yearly') {
    for (let i = 0; i < 12; i++) {
      const month = new Date(today.getFullYear(), i, 1);
      const count = attendanceRecords.filter(
        a => new Date(a.logDate).getMonth() === i &&
          new Date(a.logDate).getFullYear() === today.getFullYear()
      ).length;
      attendanceData.push({ name: month.toLocaleString('default', { month: 'short' }), count });
    }
  }
  return attendanceData;
}


export {
  getAttendanceRecords,
  getEmployeeDepartmentMapping,
  getApprovedLeaves,
  buildAttendanceData,
  getApprovedLeave,
  calculateDuration,
  updateTimeOutForYesterday,
  markAbsentEmployees
};
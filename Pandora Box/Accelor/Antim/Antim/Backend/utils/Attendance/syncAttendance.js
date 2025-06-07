// refactored syncAttendance.js
import { connectSQL } from '../../config/sql.js';
import RawPunchLog from '../../models/RawPunchLog.js';
import Attendance from '../../models/Attendance.js';
import Employee from '../../models/Employee.js';
import SyncMetadata from '../../models/SyncMetaData.js';
import { calculateDuration, getApprovedLeave } from './attendanceUtils.js';

const syncAttendance = async () => {
  try {
    const rawCount = await RawPunchLog.countDocuments();
    let meta = await SyncMetadata.findOne({ name: 'attendanceSync' });
    let fromDate = rawCount === 0 || !meta ? new Date('1970-01-01') : new Date(meta.lastSyncedAt);

    if (!meta) {
      meta = await SyncMetadata.create({ name: 'attendanceSync', lastSyncedAt: fromDate });
    }

    const toDate = new Date();
    const pool = await connectSQL();
    const result = await pool.request().query(
      `SELECT UserID, LogDate, LogTime, Direction FROM Punchlogs WHERE LogDate >= '${fromDate.toISOString().split('T')[0]}'`
    );

    const logs = result.recordset.map(log => {
      let time = typeof log.LogTime === 'number' ?
        new Date(log.LogTime * 1000).toISOString().split('T')[1].substring(0, 8) :
        typeof log.LogTime === 'string' ? log.LogTime :
        log.LogTime instanceof Date ? log.LogTime.toISOString().split('T')[1].substring(0, 8) :
        null;

      return time ? {
        UserID: log.UserID.trim(),
        LogDate: new Date(log.LogDate),
        LogTime: time,
        Direction: (log.Direction || 'out').toLowerCase(),
        processed: false,
      } : null;
    }).filter(Boolean);

    const unique = [...new Map(logs.map(log => [`${log.UserID}_${log.LogDate.toISOString()}_${log.LogTime}`, log])).values()];
    const newLogs = [];

    for (const log of unique) {
      const exists = await RawPunchLog.exists({
        UserID: log.UserID,
        LogDate: log.LogDate,
        LogTime: log.LogTime,
      });
      if (!exists) newLogs.push(log);
    }

    if (newLogs.length > 0) await RawPunchLog.insertMany(newLogs);

    const employees = await Employee.find();
    const unprocessedLogs = await RawPunchLog.find({ processed: false });
    const grouped = {};

    unprocessedLogs.forEach(log => {
      const key = `${log.UserID}_${log.LogDate.toISOString().split('T')[0]}`;
      if (!grouped[key]) grouped[key] = [];
      grouped[key].push(log);
    });

    for (const key in grouped) {
      const logs = grouped[key].sort((a, b) => a.LogTime.localeCompare(b.LogTime));
      const userId = logs[0].UserID;
      const employee = employees.find(emp => emp.userId === userId);
      if (!employee) continue;

      const logDate = new Date(logs[0].LogDate);
      logDate.setHours(0, 0, 0, 0);
      const today = new Date(); today.setHours(0, 0, 0, 0);
      const isToday = logDate.getTime() === today.getTime();

      const leave = await getApprovedLeave(employee.employeeId, logDate, 'halfDay');
      let timeIn = logs[0].LogTime;
      let status = 'Present';
      let halfDay = null;

      if (leave) {
        if (leave.halfDay.session === 'forenoon') {
          const afternoon = logs.find(log => log.LogTime >= '13:30:00');
          if (afternoon) {
            timeIn = afternoon.LogTime;
            status = 'Half Day';
            halfDay = 'Second Half';
          } else continue;
        } else if (leave.halfDay.session === 'afternoon') {
          const morning = logs.find(log => log.LogTime < '13:30:00');
          if (!morning) continue;
          status = 'Half Day';
          halfDay = 'First Half';
        }
      }

      const lastLog = logs[logs.length - 1];
      const existing = await Attendance.findOne({ employeeId: employee.employeeId, logDate });

      if (existing) {
        existing.timeIn = timeIn;
        existing.status = status;
        existing.halfDay = halfDay;
        existing.ot = 0;
        if (!isToday) {
          existing.timeOut = lastLog.LogTime;
          const duration = calculateDuration(timeIn, lastLog.LogTime);
          existing.ot = Math.max(0, duration - 510);
          if (duration < 240) {
            existing.status = 'Half Day';
            existing.halfDay = 'First Half';
          }
        }
        await existing.save();
      } else {
        const duration = isToday ? 0 : calculateDuration(timeIn, lastLog.LogTime);
        await Attendance.create({
          employeeId: employee.employeeId,
          userId,
          name: employee.name,
          logDate,
          timeIn,
          timeOut: isToday ? null : lastLog.LogTime,
          status,
          halfDay,
          ot: status === 'Present' ? Math.max(0, duration - 510) : 0,
        });
      }

      for (const log of logs) {
        log.processed = true;
        await log.save();
      }
    }

    await RawPunchLog.deleteMany({ processed: true });
    await SyncMetadata.findOneAndUpdate({ name: 'attendanceSync' }, { lastSyncedAt: toDate });
    console.log('✅ Attendance sync complete.');

  } catch (err) {
    console.error('❌ Sync error:', err.message);
  }
};

export { syncAttendance };

import { Schema, model } from 'mongoose';

const attendanceSchema = new Schema({
  employeeId: { type: String, required: true, ref: 'Employee' },
  userId: { type: String, required: true },
  name: { type: String, required: true },
  logDate: { type: Date, required: true },
  timeIn: { type: String }, // First IN time, optional
  timeOut: { type: String }, // Last OUT time
  status: { type: String, enum: ['Present', 'Absent', 'Half Day'], required: true },
  halfDay: { type: String, enum: ['First Half', 'Second Half', null], default: null }, // Track half-day absences
  ot: { type: Number, default: 0 }, // Overtime in minutes
}, { timestamps: true });

export default model('Attendance', attendanceSchema);
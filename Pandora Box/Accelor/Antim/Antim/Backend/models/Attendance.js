import { Schema, model } from 'mongoose';

// ==================== ATTENDANCE SCHEMA DEFINITION ====================
const attendanceSchema = new Schema(
  {
    // ==================== EMPLOYEE IDENTIFICATION ====================
    employeeId: {
      type: String,
      required: [true, 'Employee ID is required'],
      ref: 'Employee',
      index: true,
    },

    userId: {
      type: String,
      required: [true, 'User ID is required'],
      index: true,
    },

    name: {
      type: String,
      required: [true, 'Employee name is required'],
      trim: true,
    },

    // ==================== DATE AND TIME TRACKING ====================
    logDate: {
      type: Date,
      required: [true, 'Log date is required'],
      index: true,
      validate: {
        validator(value) {
          const today = new Date();
          today.setHours(23, 59, 59, 999);
          return value <= today;
        },
        message: 'Log date cannot be in the future',
      },
    },

    // ==================== TIME IN/OUT TRACKING ====================
    timeIn: {
      type: String,
      validate: {
        validator(value) {
          // Validate time format HH:MM or HH:MM:SS
          return (
            !value ||
            /^([01]?[0-9]|2[0-3]):[0-5][0-9](:[0-5][0-9])?$/.test(value)
          );
        },
        message: 'Time In must be in HH:MM or HH:MM:SS format',
      },
    },

    timeOut: {
      type: String,
      validate: {
        validator(value) {
          return (
            !value ||
            /^([01]?[0-9]|2[0-3]):[0-5][0-9](:[0-5][0-9])?$/.test(value)
          );
        },
        message: 'Time Out must be in HH:MM or HH:MM:SS format',
      },
    },

    // ==================== ATTENDANCE STATUS ====================
    status: {
      type: String,
      enum: [
        'Present',
        'Absent',
        'Half Day',
        'Late',
        'On Leave',
        'Holiday',
        'Weekend',
      ],
      required: [true, 'Attendance status is required'],
      index: true,
    },

    // ==================== HALF DAY DETAILS ====================
    halfDay: {
      type: String,
      enum: ['First Half', 'Second Half', null],
      default: null,
      validate: {
        validator(value) {
          // Half day field should only be set when status is 'Half Day'
          return this.status !== 'Half Day' || value !== null;
        },
        message: 'Half day type must be specified when status is Half Day',
      },
    },

    // ==================== OVERTIME TRACKING ====================
    ot: {
      type: Number,
      default: 0,
    },
    otApproved: {
      type: Boolean,
      default: false,
    },
    otApprovedBy: {
      type: Schema.Types.ObjectId,
      ref: 'Employee',
    },
    otApprovalDate: {
      type: Date,
    },
    otReason: {
      type: String,
      trim: true,
      maxlength: [200, 'Overtime reason cannot exceed 200 characters'],
    },

    // ==================== LATE ARRIVAL DETAILS ====================
    lateArrival: {
      isLate: {
        type: Boolean,
        default: false,
      },
      lateByMinutes: {
        type: Number,
        default: 0,
        min: [0, 'Late minutes cannot be negative'],
      },
      reason: {
        type: String,
        trim: true,
        maxlength: [200, 'Late reason cannot exceed 200 characters'],
      },
    },

    // ==================== HOLIDAY / LEAVE FLAGS ====================
    isHoliday: {
      type: Boolean,
      default: false,
    },
    isLeave: {
      type: Boolean,
      default: false,
    },
    isWeekend: {
      type: Boolean,
      default: false,
    },
  },
  {
    timestamps: true,
  }
);

export default model('Attendance', attendanceSchema);

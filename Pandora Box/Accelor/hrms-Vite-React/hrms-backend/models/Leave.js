import { Schema, model } from 'mongoose';

const leaveSchema = new Schema({
  employeeId: { type: String, required: true },
  employee: { type: Schema.Types.ObjectId, ref: 'Employee', required: true },
  name: { type: String, required: true },
  designation: { type: String, required: true },
  department: { type: Schema.Types.ObjectId, ref: 'Department', required: true },

  // Updated field to accommodate all types
  leaveType: {
    type: String,
    enum: [
      'Casual',
      'Medical',
      'Maternity',
      'Paternity',
      'Compensatory',
      'Restricted Holidays',
      'Leave Without Pay(LWP)'
    ],
    required: true
  },

  // Removed category field (no longer needed)

  halfDay: {
    time: { type: String, enum: ['forenoon', 'afternoon'] },
    date: { type: Date }
  },

  fullDay: {
    from: { type: Date },
    to: { type: Date }
  },

  reason: { type: String, required: true },
  chargeGivenTo: { type: String, required: true },
  emergencyContact: { type: String, required: true },

  // Additional fields for specific leave types
  compensatoryEntryId: { type: Schema.Types.ObjectId, default: null },
  projectDetails: { type: String },
  restrictedHoliday: { type: String },

  status: {
    hod: { type: String, enum: ['Pending', 'Approved', 'Rejected'], default: 'Pending' },
    admin: { type: String, enum: ['Pending', 'Acknowledged'], default: 'Pending' },
    ceo: { type: String, enum: ['Pending', 'Approved', 'Rejected'], default: 'Pending' },
  },

  remarks: { type: String, default: 'N/A' }
}, { timestamps: true });

export default model('Leave', leaveSchema);

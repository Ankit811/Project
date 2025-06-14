import { Schema, model } from 'mongoose';

const otClaimSchema = new Schema({
  employeeId: { type: String, required: true },
  employee: { type: Schema.Types.ObjectId, ref: 'Employee', required: true },
  name: { type: String, required: true },
  department: { type: Schema.Types.ObjectId, ref: 'Department', required: true },
  date: { type: Date, required: true },
  hours: { type: Number, required: true },
  projectDetails: { type: String, required: true },
  compensatoryHours: { type: Number, default: 0 },
  paymentAmount: { type: Number, default: 0 },
  claimType: { type: String, enum: ['Full', 'Partial'], default: null },
  status: {
    hod: { type: String, enum: ['Pending', 'Approved', 'Rejected'], default: 'Pending' },
    admin: { type: String, enum: ['Pending', 'Acknowledged'], default: 'Pending' },
    ceo: { type: String, enum: ['Pending', 'Approved', 'Rejected'], default: 'Pending' },
  },
}, { timestamps: true });

export default model('OTClaim', otClaimSchema);
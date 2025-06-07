import pkg from 'mongoose';
const { Schema, models, model } = pkg;

const odSchema = new Schema({
  employeeId: { type: String, required: true },
  employee: { type: Schema.Types.ObjectId, ref: 'Employee', required: true },
  name: { type: String, required: true },
  designation: { type: String, required: true },
  department: { type: Schema.Types.ObjectId, ref: 'Department', required: true },
  dateOut: { type: Date, required: true },
  timeOut: { type: String, required: true },
  dateIn: { type: Date, required: true },
  timeIn: { type: String },
  purpose: { type: String, required: true },
  placeUnitVisit: { type: String, required: true },
  status: {
    hod: { type: String, enum: ['Pending', 'Approved', 'Rejected'], default: 'Pending' },
    admin: { type: String, enum: ['Pending', 'Approved', 'Rejected'], default: 'Pending' },
    ceo: { type: String, enum: ['Pending', 'Approved', 'Rejected'], default: 'Pending' },
  }
}, { timestamps: true });

export default models.OD || model('OD', odSchema);
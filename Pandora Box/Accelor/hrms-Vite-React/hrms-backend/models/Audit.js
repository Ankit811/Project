import pkg from 'mongoose';
const { Schema, models, model } = pkg;
 
const auditSchema = new Schema({
  user: { type: String, required: true }, // Changed from userId to user to match employees.js
  action: { type: String, required: true },
  details: { type: String, required: true },
}, { timestamps: true });

// Check if model is already compiled to prevent redefinition
export default models.Audit || model('Audit', auditSchema);
import pkg from 'mongoose';
const { Schema, models, model } = pkg;

const departmentSchema = new Schema({
  name: { type: String, required: true, unique: true },
}, { timestamps: true });

// Check if model is already compiled to prevent redefinition
export default models.Department || model('Department', departmentSchema);
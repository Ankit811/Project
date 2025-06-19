const mongoose = require('mongoose');

const departmentSchema = new mongoose.Schema({
  name: { type: String, required: true, unique: true },
}, { timestamps: true });

// Check if model is already compiled to prevent redefinition
module.exports = mongoose.models.Department || mongoose.model('Department', departmentSchema);
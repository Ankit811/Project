import mongoose, { Schema, model } from 'mongoose';

const departmentSchema = new Schema(
  {
    departmentId: {
      type: String,
      required: [true, 'Department ID is required'],
      unique: true,
      index: true,
    },

    departmentName: {
      type: String,
      required: [true, 'Department name is required'],
      unique: true,
      trim: true,
      index: true,
    },

    description: {
      type: String,
      trim: true,
      maxlength: 500,
    },

    head: {
      type: Schema.Types.ObjectId,
      ref: 'Employee',
    },

    isActive: {
      type: Boolean,
      default: true,
    },
  },
  {
    timestamps: true,
  }
);

export default mongoose.models.Department || mongoose.model('Department', departmentSchema);
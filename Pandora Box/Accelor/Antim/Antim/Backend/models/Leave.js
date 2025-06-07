import mongoose from 'mongoose';
import { Schema, model } from 'mongoose';

// ==================== LEAVE SCHEMA DEFINITION ====================
const leaveSchema = new Schema({
  
  // ==================== EMPLOYEE IDENTIFICATION ====================
  employeeId: { 
    type: String, 
    required: [true, 'Employee ID is required'],
    index: true
  },
  employee: { 
    type: Schema.Types.ObjectId, 
    ref: 'Employee', 
    required: [true, 'Employee reference is required'],
    index: true
  },
  
  // ==================== EMPLOYEE DETAILS ====================
  name: { 
    type: String, 
    required: [true, 'Employee name is required'],
    trim: true
  },
  designation: { 
    type: String, 
    required: [true, 'Employee designation is required'],
    trim: true
  },
  department: { 
    type: Schema.Types.ObjectId, 
    ref: 'Department', 
    required: [true, 'Department reference is required'],
    index: true
  },

  // ==================== LEAVE CLASSIFICATION ====================
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
    required: [true, 'Leave type is required'],
    index: true
},
category: { 
    type: String, 
    enum: ['Paid', 'Unpaid'],
    required: [true, 'Leave category is required'],
    index: true
  },

  // ==================== LEAVE DURATION ====================
  halfDay: {
    time: { 
      type: String, 
      enum: ['forenoon', 'afternoon'],
    },
    date: { 
      type: Date,
      required: true,
    }
  },

  fullDay: {
    from: { 
      type: Date,
      validate: {
        validator: function(value) {
          const today = new Date();
          today.setHours(0, 0, 0, 0);
          return !value || value >= today;
        },
        message: 'Start date cannot be in the past'
      }
    },
    to: { 
      type: Date,
      validate: {
        validator: function(value) {
          // Ensure 'to' date is not before 'from' date
          return !value || !this.fullDay.from || value >= this.fullDay.from;
        },
        message: 'End date cannot be before start date'
      }
    }
  },

  // ==================== LEAVE DETAILS ====================
  reason: { 
    type: String, 
    required: [true, 'Leave reason is required'],
    trim: true,
    maxlength: [500, 'Reason cannot exceed 500 characters']
  },
  chargeGivenTo: { 
    type: String, 
    required: [true, 'Charge given to field is required'],
    trim: true
  },
  emergencyContact: { 
    type: String, 
    required: [true, 'Emergency contact is required'],
    trim: true,
    validate: {
      validator: function(value) {
        // Basic phone number validation
        return /^[\+]?[1-9][\d]{0,15}$/.test(value.replace(/\s/g, ''));
      },
      message: 'Please provide a valid emergency contact number'
    }
  },

  // ==================== COMPENSATORY LEAVE ====================
  isCompensatory: { 
    type: Boolean, 
    default: false,
    index: true
  },
  compensatoryEntryId: { type: mongoose.Schema.Types.ObjectId, default: null },
  projectDetails: { type: String },
  restrictedHoliday: { type: String },

  status: {
    hod: { type: String, enum: ['Pending', 'Approved', 'Rejected'], default: 'Pending' },
    admin: { type: String, enum: ['Pending', 'Approved', 'Rejected'], default: 'Pending' },
    ceo: { type: String, enum: ['Pending', 'Approved', 'Rejected'], default: 'Pending' },
  },
    // day: { 
    //   type: String,
    //   required: function() {
    //     return this.isCompensatory === true;
    //   },
    //   enum: {
    //     values: ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'],
    //     message: 'Day must be a valid day of the week'
    //   }
    // },

  // ==================== OVERTIME LEAVE ====================
  
  isOvertime: {
      type: Boolean,
      default: false,
      index: true,
    },
    
    
  // ==================== RESTRICTED LEAVE ====================

    isRestricted: {
        type: Boolean,
        default: false,
        index: true,
    },
});

export default model('Leave', leaveSchema);


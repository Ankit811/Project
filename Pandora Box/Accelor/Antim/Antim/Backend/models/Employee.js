import { Schema, model } from 'mongoose';
import bcrypt from 'bcrypt';
import handleLeaveReset from '../utils/Leave/leaveReset.js';

const employeeSchema = new Schema(
  {
    // ==================== BASIC INFORMATION ====================
    employeeId: {
      type: String,
      unique: true,
      required: [true, 'Employee ID is required'],
      index: true,
    },

    userId: {
      type: String,
      unique: true,
      required: [true, 'User ID is required'],
      index: true,
    },

    email: {
      type: String,
      unique: true,
      required: [true, 'Email is required'],
      index: true,
      lowercase: true,
      trim: true,
    },

    password: {
      type: String,
      minlength: [6, 'Password must be at least 6 characters long'],
      select: false, // Do not return password in queries by default
    },

    name: {
      type: String,
      required: [true, 'Name is required'],
      index: true,
      trim: true,
    },

    dateOfBirth: {
      type: Date,
    },

    fatherName: {
      type: String,
      trim: true,
    },

    motherName: {
      type: String,
      trim: true,
    },

    permanentAddress: {
      type: String,
      trim: true,
    },

    currentAddress: {
      type: String,
      trim: true,
    },

    aadharNumber: {
      type: String,
      match: [/^\d{12}$/, 'Aadhar number must be 12 digits'],
      sparse: true,
    },

    bloodGroup: {
      type: String,
      enum: ['A+', 'A-', 'B+', 'B-', 'AB+', 'AB-', 'O+', 'O-'],
    },

    gender: {
      type: String,
      enum: ['Male', 'Female', 'Other'],
    },

    maritalStatus: {
      type: String,
      enum: ['Single', 'Married', 'Divorced', 'Widowed'],
    },

    spouseName: {
      type: String,
      required: function () {
        return this.maritalStatus === 'Married';
      },
      trim: true,
    },

    // ==================== CONTACT INFORMATION ====================
    mobileNumber: {
      type: String,
      match: [/^\d{10}$/, 'Mobile number must be 10 digits'],
      sparse: true,
    },

    emergencyContactName: {
      type: String,
      trim: true,
    },

    emergencyContactNumber: {
      type: String,
      trim: true,
    },

    // ==================== EMPLOYMENT DETAILS ====================
    dateOfJoining: {
      type: Date,
    },

    reportingManager: {
      type: Schema.Types.ObjectId,
      ref: 'Employee',
    },

    status: {
      type: String,
      enum: ['Working', 'Resigned'],
      default: 'Working',
    },

    dateOfResigning: {
      type: Date,
      required: function () {
        return this.status === 'Resigned';
      },
    },

    employeeType: {
      type: String,
      enum: ['Intern', 'Confirmed', 'Contractual', 'Probation'],
      required: function () {
        return this.status === 'Working';
      },
    },

    probationPeriod: {
      type: Number,
      required: function () {
        return this.status === 'Working' && this.employeeType === 'Probation';
      },
    },

    confirmationDate: {
      type: Date,
      required: function () {
        return this.status === 'Working' && this.employeeType === 'Probation';
      },
    },

    // ==================== ADDITIONAL DETAILS ====================
    referredBy: {
      type: String,
      trim: true,
    },

    loginType: {
      type: String,
      enum: ['Employee', 'HOD', 'Admin', 'CEO'],
      required: true,
    },

    designation: {
      type: String,
      trim: true,
    },

    location: {
      type: String,
      trim: true,
    },

    department: {
      type: Schema.Types.ObjectId,
      ref: 'Department',
    },

    // ==================== STATUTORY INFORMATION ====================
    panNumber: {
      type: String,
      uppercase: true,
      match: [/^[A-Z0-9]{10}$/, 'PAN number must be 10 characters'],
      sparse: true,
      trim: true,
    },

    pfNumber: {
      type: String,
      match: [/^\d{18}$/, 'PF number must be 18 digits'],
      sparse: true,
      trim: true,
    },

    uanNumber: {
      type: String,
      match: [/^\d{12}$/, 'UAN number must be 12 digits'],
      sparse: true,
      trim: true,
    },

    esiNumber: {
      type: String,
      match: [/^\d{12}$/, 'ESI number must be 12 digits'],
      sparse: true,
      trim: true,
    },

    // ==================== DOCUMENTS & FILES ====================
    profilePicture: {
      type: Schema.Types.ObjectId,
      ref: 'Uploads.files',
    },

    documents: [
      {
        type: Schema.Types.ObjectId,
        ref: 'Uploads.files',
      },
    ],

    // ==================== PAYMENT INFORMATION ====================
    paymentType: {
      type: String,
      enum: ['Cash', 'Bank Transfer'],
    },

    bankDetails: {
      bankName: {
        type: String,
        required: function () {
          return this.paymentType === 'Bank Transfer';
        },
        trim: true,
      },
      bankBranch: {
        type: String,
        required: function () {
          return this.paymentType === 'Bank Transfer';
        },
        trim: true,
      },
      accountNumber: {
        type: String,
        required: function () {
          return this.paymentType === 'Bank Transfer';
        },
        trim: true,
      },
      ifscCode: {
        type: String,
        required: function () {
          return this.paymentType === 'Bank Transfer';
        },
        trim: true,
      },
    },

    // ==================== SECURITY & LOCKS ====================
    locked: {
      type: Boolean,
      default: true,
    },

    basicInfoLocked: {
      type: Boolean,
      default: true,
    },

    positionLocked: {
      type: Boolean,
      default: true,
    },

    statutoryLocked: {
      type: Boolean,
      default: true,
    },

    documentsLocked: {
      type: Boolean,
      default: true,
    },

    paymentLocked: {
      type: Boolean,
      default: true,
    },

    // ==================== LEAVE MANAGEMENT ====================
    paidLeaves: {
      type: Number,
      default: 12,
    }, // Casual leaves only

    medicalLeaves: {
      type: Number,
      default: 7,
    },

    maternityClaims: {
      type: Number,
      default: 0,
    },

    paternityClaims: {
      type: Number,
      default: 0,
    },

    restrictedHolidays: {
      type: Number,
      default: 1,
    },

    unpaidLeavesTaken: {
      type: Number,
      default: 0,
    },

    compensatoryLeaves: {
      type: Number,
      default: 0,
    },

    compensatoryAvailable: [
      {
        date: {
          type: Date,
          required: true,
        },
        hours: {
          type: Number,
          enum: [4, 8],
          required: true,
        },
        status: {
          type: String,
          enum: ['Available', 'Claimed'],
          default: 'Available',
        },
      },
    ],

    lastCompensatoryReset: {
      type: Date,
    },

    lastLeaveReset: {
      type: Date,
    },

    lastMonthlyReset: {
      type: Date,
    },

    lastMedicalReset: {
      type: Date,
    },

    lastRestrictedHolidayReset: {
      type: Date,
    },
  },
  {
    timestamps: true,
  }
);

// ==================== INSTANCE METHODS ====================
employeeSchema.methods.getEditableFields = function () {
  const fieldGroups = {
    basicInfo: [
      'name',
      'email',
      'mobileNumber',
      'dateOfBirth',
      'gender',
      'permanentAddress',
      'emergencyContactName',
      'emergencyContactNumber',
    ],
    position: [
      'department',
      'designation',
      'dateOfJoining',
      'employeeType',
      'location',
      'reportingManager',
      'probationPeriod',
    ],
    statutory: [
      'panNumber',
      'aadharNumber',
      'pfNumber',
      'esiNumber',
      'uanNumber',
    ],
    payment: ['paymentType', 'bankDetails'],
    documents: ['profilePicture', 'documents'],
  };

  const editableFields = [];

  for (const [section, fields] of Object.entries(fieldGroups)) {
    const lockField = `${section}Locked`;
    if (!this[lockField]) {
      editableFields.push(...fields);
    }
  }

  return editableFields;
};

// ==================== STATIC METHODS ====================
employeeSchema.statics.getFieldGroups = function () {
  return {
    basicInfo: [
      'name',
      'email',
      'mobileNumber',
      'dateOfBirth',
      'gender',
      'permanentAddress',
      'emergencyContactName',
      'emergencyContactNumber',
    ],
    position: [
      'department',
      'designation',
      'dateOfJoining',
      'employeeType',
      'location',
      'reportingManager',
      'probationPeriod',
    ],
    statutory: [
      'panNumber',
      'aadharNumber',
      'pfNumber',
      'esiNumber',
      'uanNumber',
    ],
    payment: ['paymentType', 'bankDetails'],
    documents: ['profilePicture', 'documents'],
  };
};

// ==================== MIDDLEWARE ====================
// Hash password before saving
employeeSchema.pre('save', async function (next) {
  if (!this.isModified('password')) return next();

  try {
    const salt = await bcrypt.genSalt(10);
    this.password = await bcrypt.hash(this.password, salt);
    next();
  } catch (error) {
    next(error);
  }
});

// Leave allocation and reset middleware
employeeSchema.pre('save', async function (next) {
  try {
    await handleLeaveReset(this);
    next();
  } catch (error) {
    next(error);
  }
});

export default model('Employee', employeeSchema);

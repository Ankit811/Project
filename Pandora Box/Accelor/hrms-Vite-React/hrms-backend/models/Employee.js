import { Schema, model } from 'mongoose';
import { hash, compare } from 'bcryptjs';
import Leave from './Leave.js';

const employeeSchema = new Schema({
  employeeId: { type: String, unique: true },
  userId: { type: String, unique: true },
  email: { type: String, unique: true },
  password: {
    type: String,
    minlength: [6, 'Password must be at least 6 characters long']
  },
  name: String,
  dateOfBirth: Date,
  fatherName: String,
  motherName: String,
  mobileNumber: { type: String, match: /^\d{10}$/ },
  permanentAddress: String,
  currentAddress: String,
  aadharNumber: { type: String, match: /^\d{12}$/ },
  bloodGroup: { type: String, enum: ['A+', 'A-', 'B+', 'B-', 'AB+', 'AB-', 'O+', 'O-'] },
  gender: { type: String, enum: ['Male', 'Female', 'Other'] },
  maritalStatus: { type: String, enum: ['Single', 'Married'] },
  spouseName: { 
    type: String,
    required: function() { return this.maritalStatus === 'Married'; } 
  },
  emergencyContactName: String,
  emergencyContactNumber: String,
  dateOfJoining: Date,
  reportingManager: { type: Schema.Types.ObjectId, ref: 'Employee' },
  status: { type: String, enum: ['Working', 'Resigned'] },
  dateOfResigning: { 
    type: Date,
    required: function() { return this.status === 'Resigned'; } 
  },
  employeeType: { 
    type: String, 
    enum: ['Intern', 'Confirmed', 'Contractual', 'Probation'],
    required: function() { return this.status === 'Working'; }
  },
  probationPeriod: { 
    type: Number,
    required: function() { return this.status === 'Working' && this.employeeType === 'Probation'; } 
  },
  confirmationDate: { 
    type: Date,
    required: function() { return this.status === 'Working' && this.employeeType === 'Probation'; } 
  },
  referredBy: String,
  loginType: { type: String, enum: ['Employee', 'HOD', 'Admin', 'CEO'] },
  designation: String,
  location: String,
  department: { type: Schema.Types.ObjectId, ref: 'Department' },
  panNumber: { type: String, match: /^[A-Z0-9]{10}$/ },
  pfNumber: { type: String, match: /^\d{18}$/, sparse: true },
  uanNumber: { type: String, match: /^\d{12}$/, sparse: true },
  esiNumber: { type: String, match: /^\d{12}$/, sparse: true },
  profilePicture: { type: Schema.Types.ObjectId, ref: 'Uploads.files' },
  documents: [{ type: Schema.Types.ObjectId, ref: 'Uploads.files' }],
  paymentType: { type: String, enum: ['Cash', 'Bank Transfer'] },
  bankDetails: {
    bankName: { 
      type: String,
      required: function() { return this.paymentType === 'Bank Transfer'; } 
    },
    bankBranch: { 
      type: String,
      required: function() { return this.paymentType === 'Bank Transfer'; } 
    },
    accountNumber: { 
      type: String,
      required: function() { return this.paymentType === 'Bank Transfer'; } 
    },
    ifscCode: { 
      type: String,
      required: function() { return this.paymentType === 'Bank Transfer'; } 
    },
  },
  locked: { type: Boolean, default: true },
  basicInfoLocked: { type: Boolean, default: true },
  positionLocked: { type: Boolean, default: true },
  statutoryLocked: { type: Boolean, default: true },
  documentsLocked: { type: Boolean, default: true },
  paymentLocked: { type: Boolean, default: true },
  paidLeaves: { type: Number, default: 0 }, // Tracks Casual leaves only
  medicalLeaves: { type: Number, default: 7 }, // Tracks Medical leaves (7 per year)
  maternityClaims: { type: Number, default: 0 }, // Tracks Maternity leave claims (max 2)
  paternityClaims: { type: Number, default: 0 }, // Tracks Paternity leave claims (max 2)
  restrictedHolidays: { type: Number, default: 1 }, // Tracks Restricted Holiday (1 per year)
  unpaidLeavesTaken: { type: Number, default: 0 },
  compensatoryLeaves: { type: Number, default: 0 }, // Tracks total compensatory leave hours
  compensatoryAvailable: [{
    date: { type: Date, required: true },
    hours: { type: Number, enum: [4, 8], required: true },
    status: { type: String, enum: ['Available', 'Claimed'], default: 'Available' }
  }],
  lastCompensatoryReset: { type: Date }, // Tracks last reset for expiration
  lastLeaveReset: { type: Date }, // For Casual leaves (Confirmed)
  lastMonthlyReset: { type: Date }, // For Casual leaves (Non-Confirmed)
  lastMedicalReset: { type: Date }, // For Medical leaves
  lastRestrictedHolidayReset: { type: Date }, // For Restricted Holiday
}, { timestamps: true });

// Middleware to handle password hashing
employeeSchema.pre('save', async function(next) {
  if (this.isModified('password') && this.password) {
    this.password = await hash(this.password, 10);
  }
  next();
});

// Middleware to handle leave allocation and reset
employeeSchema.pre('save', async function(next) {
  const today = new Date();
  const currentYear = today.getFullYear();
  const currentMonth = today.getMonth();

  // Initialize reset dates and leaves for new employees
  if (this.isNew) {
    if (this.employeeType === 'Confirmed') {
      const joinDate = new Date(this.dateOfJoining);
      const joinMonth = joinDate.getMonth(); // 0 = January, 11 = December
      this.paidLeaves = 12 - joinMonth; // Casual leaves: E.g., join in March (month 2) -> 12 - 2 = 10
      this.lastLeaveReset = new Date(currentYear, 0, 1);
    } else if (['Intern', 'Contractual', 'Probation'].includes(this.employeeType)) {
      this.paidLeaves = 1; // Casual leaves: Start with 1 leave for the current month
      this.lastMonthlyReset = new Date(currentYear, currentMonth, 1);
    }
    // Initialize other paid leaves
    this.medicalLeaves = 7;
    this.restrictedHolidays = 1;
    this.lastMedicalReset = new Date(currentYear, 0, 1);
    this.lastRestrictedHolidayReset = new Date(currentYear, 0, 1);
    this.maternityClaims = 0;
    this.paternityClaims = 0;
    this.compensatoryLeaves = 0;
    this.lastCompensatoryReset = new Date(currentYear, currentMonth, 1);
  }

  // Handle compensatory leave expiration (6 months)
  const lastReset = this.lastCompensatoryReset ? new Date(this.lastCompensatoryReset) : null;
  if (lastReset) {
    const sixMonthsLater = new Date(lastReset);
    sixMonthsLater.setMonth(lastReset.getMonth() + 6);
    if (today >= sixMonthsLater) {
      this.compensatoryLeaves = 0; // Reset compensatory leaves after 6 months
      this.lastCompensatoryReset = new Date(currentYear, currentMonth, 1);
    }
  }

  // Handle Casual leave resets
  if (this.employeeType === 'Confirmed') {
    const lastResetYear = this.lastLeaveReset ? new Date(this.lastLeaveReset).getFullYear() : null;
    if (!lastResetYear || lastResetYear < currentYear) {
      this.paidLeaves = 12; // Reset Casual leaves to 12 for new year
      this.lastLeaveReset = new Date(currentYear, 0, 1);
    }
  } else if (['Intern', 'Contractual', 'Probation'].includes(this.employeeType)) {
    const lastResetMonth = this.lastMonthlyReset ? new Date(this.lastMonthlyReset).getMonth() : null;
    const lastResetYear = this.lastMonthlyReset ? new Date(this.lastMonthlyReset).getFullYear() : null;
    if (
      !lastResetMonth ||
      lastResetYear < currentYear ||
      (lastResetYear === currentYear && lastResetMonth < currentMonth)
    ) {
      this.paidLeaves = (this.paidLeaves || 0) + 1; // Add 1 Casual leave, carry forward
      this.lastMonthlyReset = new Date(currentYear, currentMonth, 1);
    }
  }

  // Handle Medical leave reset
  const lastMedicalResetYear = this.lastMedicalReset ? new Date(this.lastMedicalReset).getFullYear() : null;
  if (!lastMedicalResetYear || lastMedicalResetYear < currentYear) {
    this.medicalLeaves = 7; // Reset Medical leaves to 7 for new year
    this.lastMedicalReset = new Date(currentYear, 0, 1);
  }

  // Handle Restricted Holiday reset
  const lastRestrictedResetYear = this.lastRestrictedHolidayReset ? new Date(this.lastRestrictedHolidayReset).getFullYear() : null;
  if (!lastRestrictedResetYear || lastRestrictedResetYear < currentYear) {
    this.restrictedHolidays = 1; // Reset Restricted Holiday to 1 for new year
    this.lastRestrictedHolidayReset = new Date(currentYear, 0, 1);
  }

  next();
});

// Method to compare passwords
employeeSchema.methods.comparePassword = async function(password) {
  return await compare(password, this.password);
};

// Method to check for three consecutive paid leaves
employeeSchema.methods.checkConsecutivePaidLeaves = async function(newLeaveStart, newLeaveEnd) {
  const normalizeDate = (date) => {
    const d = new Date(date);
    d.setHours(0, 0, 0, 0);
    return d;
  };

  newLeaveStart = normalizeDate(newLeaveStart);
  newLeaveEnd = normalizeDate(newLeaveEnd);

  const newLeaveDays = newLeaveStart.getTime() === newLeaveEnd.getTime() ? 0.5 : ((newLeaveEnd - newLeaveStart) / (1000 * 60 * 60 * 24)) + 1;
  if (newLeaveDays > 3) {
    return false; // No paid leaves allowed for more than 3 consecutive days
  }

  const leaves = await Leave.find({
    employeeId: this.employeeId,
    leaveType: { $in: ['Casual', 'Medical', 'Maternity', 'Paternity', 'Restricted Holidays'] }, // All paid leave types
    'status.hod': 'Approved',
    'status.admin': 'Approved',
    'status.ceo': 'Approved',
    $or: [
      {
        'fullDay.from': { $lte: newLeaveEnd },
        'fullDay.to': { $gte: newLeaveStart },
      },
      {
        'halfDay.date': { $gte: newLeaveStart, $lte: newLeaveEnd },
      },
    ],
  });

  let totalDays = newLeaveDays;
  for (const leave of leaves) {
    if (leave.halfDay?.date) {
      totalDays += 0.5;
    } else if (leave.fullDay?.from && leave.fullDay?.to) {
      const from = normalizeDate(leave.fullDay.from);
      const to = normalizeDate(leave.fullDay.to);
      totalDays += ((to - from) / (1000 * 60 * 60 * 24)) + 1;
    }
  }

  return totalDays <= 3;
};

// Method to deduct paid leaves (Casual only)
employeeSchema.methods.deductPaidLeaves = async function(leaveStart, leaveEnd) {
  if (!leaveStart || !leaveEnd) return;

  const normalizeDate = (date) => {
    const d = new Date(date);
    d.setHours(0, 0, 0, 0);
    return d;
  };

  leaveStart = normalizeDate(leaveStart);
  leaveEnd = normalizeDate(leaveEnd);

  let days = 0;
  if (leaveStart.getTime() === leaveEnd.getTime()) {
    days = 0.5;
  } else {
    days = ((leaveEnd - leaveStart) / (1000 * 60 * 60 * 24)) + 1;
  }

  console.log(`Deducting ${days} days for Casual leave from ${leaveStart.toISOString()} to ${leaveEnd.toISOString()} for employee ${this.employeeId}`);

  this.paidLeaves = Math.max(0, this.paidLeaves - days);
  await this.save();
};

// Method to deduct medical leaves
employeeSchema.methods.deductMedicalLeaves = async function(days) {
  this.medicalLeaves = Math.max(0, this.medicalLeaves - days);
  await this.save();
};

// Method to deduct restricted holidays
employeeSchema.methods.deductRestrictedHolidays = async function() {
  this.restrictedHolidays = Math.max(0, this.restrictedHolidays - 1);
  await this.save();
};

// Method to add compensatory leave entry
employeeSchema.methods.addCompensatoryLeave = async function(date, hours) {
  if (![4, 8].includes(hours)) {
    throw new Error('Compensatory leave must be 4 or 8 hours');
  }
  this.compensatoryAvailable.push({ date, hours, status: 'Available' });
  this.compensatoryLeaves = (this.compensatoryLeaves || 0) + hours;
  await this.save();
};

// Method to deduct compensatory leaves
employeeSchema.methods.deductCompensatoryLeaves = async function(entryId) {
  const entry = this.compensatoryAvailable.find(e => e._id.toString() === entryId && e.status === 'Available');
  if (!entry) {
    throw new Error('Invalid or already claimed compensatory leave entry');
  }
  entry.status = 'Claimed';
  this.compensatoryLeaves = Math.max(0, this.compensatoryLeaves - entry.hours);
  const days = entry.hours === 4 ? 0.5 : 1;
  this.paidLeaves = (this.paidLeaves || 0) + days;
  await this.save();
};

// Method to record maternity leave claim
employeeSchema.methods.recordMaternityClaim = async function() {
  this.maternityClaims = (this.maternityClaims || 0) + 1;
  await this.save();
};

// Method to record paternity leave claim
employeeSchema.methods.recordPaternityClaim = async function() {
  this.paternityClaims = (this.paternityClaims || 0) + 1;
  await this.save();
};

// Method to increment unpaid leaves taken
employeeSchema.methods.incrementUnpaidLeaves = async function(leaveStart, leaveEnd) {
  if (!leaveStart || !leaveEnd) return;

  const normalizeDate = (date) => {
    const d = new Date(date);
    d.setHours(0, 0, 0, 0);
    return d;
  };

  leaveStart = normalizeDate(leaveStart);
  leaveEnd = normalizeDate(leaveEnd);

  let days = 0;
  if (leaveStart.getTime() === leaveEnd.getTime()) {
    days = 0.5;
  } else {
    days = ((leaveEnd - leaveStart) / (1000 * 60 * 60 * 24)) + 1;
  }

  this.unpaidLeavesTaken = (this.unpaidLeavesTaken || 0) + days;
  await this.save();
};

export default model('Employee', employeeSchema);

import { Schema, model } from 'mongoose';

const auditSchema = new Schema(
  {
    action: {
      type: String,
      required: [true, 'Action is required'],
      trim: true,
    },

    performedBy: {
      type: Schema.Types.ObjectId,
      ref: 'Employee',
      required: [true, 'PerformedBy is required'],
    },

    targetId: {
      type: String,
      required: [true, 'Target User ID is required'],
      index: true,
    },

    targetName: {
      type: String,
      trim: true,
    },

    timestamp: {
      type: Date,
      default: Date.now,
      index: true,
    },

    details: {
      type: Schema.Types.Mixed,
      default: {},
    },

    ipAddress: {
      type: String,
      trim: true,
      validate: {
        validator: function (v) {
          // Simple IPv4 and IPv6 regex validation (basic)
          return (
            !v ||
            /^((25[0-5]|2[0-4][0-9]|[01]?[0-9][0-9]?)(\.|$)){4}$/.test(v) ||
            /^([0-9a-fA-F]{1,4}:){7}[0-9a-fA-F]{1,4}$/.test(v)
          );
        },
        message: 'Invalid IP address format',
      },
    },

    userAgent: {
      type: String,
      trim: true,
    },
  },
  {
    timestamps: true,
  }
);

export default model('Audit', auditSchema);

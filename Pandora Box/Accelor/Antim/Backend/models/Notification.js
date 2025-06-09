import { Schema, model } from 'mongoose';

const notificationSchema = new Schema({
  userId: { type: String, required: true },
  message: { type: String, required: true },
  read: { type: Boolean, default: false },
}, { timestamps: true });

export default model('Notification', notificationSchema);
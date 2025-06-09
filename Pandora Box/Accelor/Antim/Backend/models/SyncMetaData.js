// models/SyncMetadata.js

import { Schema, model } from 'mongoose';

const syncMetadataSchema = new Schema({
  name: { type: String, required: true, unique: true },
  lastSyncedAt: { type: Date, required: true },
});

export default model('SyncMetadata', syncMetadataSchema);

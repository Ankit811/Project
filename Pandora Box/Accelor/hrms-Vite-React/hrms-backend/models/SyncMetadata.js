// models/SyncMetadata.js

const mongoose = require('mongoose');

const syncMetadataSchema = new mongoose.Schema({
  name: { type: String, required: true, unique: true },
  lastSyncedAt: { type: Date, required: true },
});

module.exports = mongoose.model('SyncMetadata', syncMetadataSchema);

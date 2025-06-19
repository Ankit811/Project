// utils/gridfs.js
const mongoose = require('mongoose');

let gfs = null;

mongoose.connection.once('open', () => {
  gfs = new mongoose.mongo.GridFSBucket(mongoose.connection.db, { bucketName: 'Uploads' });
  console.log('Central GridFS initialized');
});

const gfsReady = () => !!gfs;
const getGfs = () => gfs;

module.exports = { getGfs, gfsReady };
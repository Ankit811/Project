// utils/gridfs.js
import pkg from 'mongoose';
const { connection, mongo } = pkg;

let gfs = null;

connection.once('open', () => {
  gfs = new mongo.GridFSBucket(connection.db, { bucketName: 'Uploads' });
  console.log('Central GridFS initialized');
});

const gfsReady = () => !!gfs;
const getGfs = () => gfs;

export { getGfs, gfsReady };
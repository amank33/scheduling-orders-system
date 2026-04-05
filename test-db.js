require('dotenv').config();
const mongoose = require('mongoose');

console.log('Testing MongoDB connection...');
console.log('URI:', process.env.MONGO_URI.substring(0, 50) + '...');

mongoose.connect(process.env.MONGO_URI)
  .then(() => {
    console.log('[PASS] MongoDB connected successfully!');
    console.log('Database:', mongoose.connection.name);
    console.log('Host:', mongoose.connection.host);
  })
  .catch((err) => {
    console.log('[FAIL] Connection failed:');
    console.log(err.message);
    process.exit(1);
  })
  .finally(() => {
    mongoose.connection.close();
    process.exit(0);
  });

setTimeout(() => {
  console.log('[FAIL] Connection timeout');
  process.exit(1);
}, 10000);

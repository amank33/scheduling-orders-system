const mongoose = require('mongoose');

// connect to mongodb
const dbConnect = async () => {
  try {
    const con = await mongoose.connect(process.env.MONGO_URI);
    console.log('MongoDB connected');
  } catch (err) {
    console.log('DB error:', err);
  }
};

module.exports = dbConnect;

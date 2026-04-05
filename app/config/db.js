const mongoose = require('mongoose');

// connect to MongoDB database
const dbConnect = async () => {
  try {
    const connection = await mongoose.connect(process.env.MONGO_URI);
    console.log('MongoDB is connected');
  } catch (err) {
    console.log('database error:', err);
  }
};

module.exports = dbConnect;

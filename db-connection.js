const mongoose = require('mongoose');

const db = mongoose.connect(process.env.MONGO_URL, {
  useUnifiedTopology: true,
  useNewUrlParser: true,
});

module.exports = db;
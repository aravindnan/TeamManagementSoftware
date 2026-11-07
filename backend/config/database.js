const mongoose = require("mongoose");
const { mongoUri } = require("./env");

mongoose.set("strictQuery", true);

const connectToDatabase = (uri = mongoUri) => mongoose.connect(uri);
const disconnectFromDatabase = () => mongoose.disconnect();

module.exports = { connectToDatabase, disconnectFromDatabase };

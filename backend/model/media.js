const mongoose = require("mongoose");

const mediaSchema = new mongoose.Schema({
  mediaType: { type: String },
  mediaURL: { type: String, required: true },
  mediaName: { type: String },
  mediaSize: { type: Number },
  uploadedBy: { type: mongoose.Schema.Types.ObjectId, ref: "User" },
});

module.exports = { mediaSchema };

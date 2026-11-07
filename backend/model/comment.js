const mongoose = require("mongoose");

const commentSchema = new mongoose.Schema({
  senderName: { type: String, required: true },
  messageContent: { type: String, required: true, maxlength: 2000 },
  senderId: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true },
  timeStamp: { type: Date, default: Date.now },
});

module.exports = mongoose.model("Comment", commentSchema);

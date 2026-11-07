const mongoose = require("mongoose");

// One row per recipient. Text parts are snapshotted so a notification still reads correctly
// after the task or project it mentions is gone.
const notificationSchema = new mongoose.Schema({
  user: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true },
  type: { type: String, required: true }, // same vocabulary as Activity.verb
  actorName: { type: String, default: "Someone" },
  project: { type: mongoose.Schema.Types.ObjectId, ref: "Project" },
  projectName: { type: String },
  task: { type: mongoose.Schema.Types.ObjectId },
  data: { type: mongoose.Schema.Types.Mixed, default: {} },
  readAt: { type: Date },
  createdAt: { type: Date, default: Date.now },
});

notificationSchema.index({ user: 1, _id: -1 });
notificationSchema.index({ user: 1, readAt: 1, _id: -1 });

module.exports = mongoose.model("Notification", notificationSchema);

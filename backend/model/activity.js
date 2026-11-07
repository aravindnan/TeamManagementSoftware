const mongoose = require("mongoose");

// Append-only log of what happened in a project. Names/titles are snapshotted into `data`
// so entries stay readable after the task, comment or user they describe is gone.
const activitySchema = new mongoose.Schema({
  project: { type: mongoose.Schema.Types.ObjectId, ref: "Project", required: true },
  actor: { type: mongoose.Schema.Types.ObjectId, ref: "User" },
  actorName: { type: String, default: "Someone" },
  verb: { type: String, required: true },
  category: { type: String, required: true, enum: ["project", "task", "comment", "file", "member"] },
  // Present for task-related entries so the UI can link to the task (it may since have been deleted).
  task: { type: mongoose.Schema.Types.ObjectId },
  data: { type: mongoose.Schema.Types.Mixed, default: {} },
  createdAt: { type: Date, default: Date.now },
});

// Feed queries: newest first, optionally narrowed to one category, paged by _id.
activitySchema.index({ project: 1, _id: -1 });
activitySchema.index({ project: 1, category: 1, _id: -1 });

module.exports = mongoose.model("Activity", activitySchema);

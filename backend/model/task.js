const mongoose = require("mongoose");
const { mediaSchema } = require("./media");
const { TASK_STATUSES } = require("../utils/constants");

const taskSchema = new mongoose.Schema(
  {
    taskTitle: { type: String, required: true, trim: true },
    taskDescription: { type: String, default: "" },
    taskPriority: { type: String, enum: ["High", "Medium", "Low"], default: "Medium" },
    project: { type: mongoose.Schema.Types.ObjectId, ref: "Project", required: true, index: true },
    assignedBy: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true },
    assignedTo: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true, index: true },
    // Existing tasks are "In Progress"/"Completed"; new tasks start in the board's first column.
    taskStatus: { type: String, enum: TASK_STATUSES, default: "To Do" },
    // Set automatically when a task enters/leaves "Completed"; feeds cycle-time statistics.
    completedAt: { type: Date },
    // Kept as strings for compatibility with the existing UI date handling.
    dueDate: { type: String },
    assignedOn: { type: String },
    attachedMediaURLSet: [mediaSchema],
    taskComments: [{ type: mongoose.Schema.Types.ObjectId, ref: "Comment" }],
  },
  { timestamps: true }
);

taskSchema.pre("save", function (next) {
  if (this.isModified("taskStatus")) {
    this.completedAt = this.taskStatus === "Completed" ? new Date() : undefined;
  }
  next();
});

module.exports = mongoose.model("Task", taskSchema);

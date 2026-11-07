const mongoose = require("mongoose");
const { mediaSchema } = require("./media");

const taskSchema = new mongoose.Schema(
  {
    taskTitle: { type: String, required: true, trim: true },
    taskDescription: { type: String, default: "" },
    taskPriority: { type: String, enum: ["High", "Medium", "Low"], default: "Medium" },
    project: { type: mongoose.Schema.Types.ObjectId, ref: "Project", required: true, index: true },
    assignedBy: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true },
    assignedTo: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true, index: true },
    taskStatus: { type: String, enum: ["In Progress", "Completed"], default: "In Progress" },
    // Kept as strings for compatibility with the existing UI date handling.
    dueDate: { type: String },
    assignedOn: { type: String },
    attachedMediaURLSet: [mediaSchema],
    taskComments: [{ type: mongoose.Schema.Types.ObjectId, ref: "Comment" }],
  },
  { timestamps: true }
);

module.exports = mongoose.model("Task", taskSchema);

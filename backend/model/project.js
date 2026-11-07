const mongoose = require("mongoose");
const { mediaSchema } = require("./media");

const projectSchema = new mongoose.Schema(
  {
    projectName: { type: String, required: true, trim: true },
    projectDescription: { type: String, default: "" },
    projectManager: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true, index: true },
    projectMembers: [{ type: mongoose.Schema.Types.ObjectId, ref: "User" }],
    allTasks: [{ type: mongoose.Schema.Types.ObjectId, ref: "Task" }],
    startDate: { type: Date, required: true, default: Date.now },
    projectStatus: { type: String, enum: ["In Progress", "Completed"], default: "In Progress" },
    attachedMediaURLSet: [mediaSchema],
    projectComments: [{ type: mongoose.Schema.Types.ObjectId, ref: "Comment" }],
  },
  { timestamps: true }
);

projectSchema.index({ projectMembers: 1 });

module.exports = mongoose.model("Project", projectSchema);

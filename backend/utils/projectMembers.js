const Project = require("../model/project");
const Task = require("../model/task");
const User = require("../model/user");

/**
 * Takes a member off a project. Their tasks in it are handed to the project manager so nothing is orphaned.
 * Returns how many tasks were handed over. (The caller checks permissions and that they are not the manager.)
 */
async function removeMemberFromProject(project, memberId) {
  const orphaned = await Task.find({ project: project._id, assignedTo: memberId }).select("_id");
  const orphanIds = orphaned.map((t) => t._id);
  if (orphanIds.length) {
    await Task.updateMany({ _id: { $in: orphanIds } }, { assignedTo: project.projectManager });
    await User.updateOne({ _id: project.projectManager }, { $push: { allTasks: { $each: orphanIds } } });
  }
  await Promise.all([
    Project.updateOne({ _id: project._id }, { $pull: { projectMembers: memberId } }),
    User.updateOne({ _id: memberId }, { $pull: { involvedProjects: project._id }, $pullAll: { allTasks: orphanIds } }),
  ]);
  return orphanIds.length;
}

module.exports = { removeMemberFromProject };

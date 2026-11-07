const Project = require("../model/project");
const Task = require("../model/task");
const { notFound, forbidden } = require("./AppError");

// Fields of another user that are safe to show to teammates (never password / DOB / token data).
const PUBLIC_USER_FIELDS = "firstName lastName username email role bio profilePictureURL";

const idEq = (a, b) => String(a && a._id ? a._id : a) === String(b && b._id ? b._id : b);
const isManager = (project, userId) => idEq(project.projectManager, userId);
const isMember = (project, userId) =>
  isManager(project, userId) || (project.projectMembers || []).some((m) => idEq(m, userId));

const loadProject = async (projectId, query = Project.findById(projectId)) => {
  const project = await query;
  if (!project) throw notFound("Project not found");
  return project;
};

const requireMember = (project, userId) => {
  if (!isMember(project, userId)) throw forbidden("You are not a member of this project");
};
const requireManager = (project, userId) => {
  if (!isManager(project, userId)) throw forbidden("Only the project manager can do that");
};

// Loads a task plus its project's membership and checks the caller belongs to the project.
const loadTaskForMember = async (taskId, userId) => {
  const task = await Task.findById(taskId);
  if (!task) throw notFound("Task not found");
  const project = await Project.findById(task.project).select("projectManager projectMembers");
  if (!project) throw notFound("Project not found");
  requireMember(project, userId);
  return { task, project };
};

module.exports = { PUBLIC_USER_FIELDS, idEq, isManager, isMember, loadProject, requireMember, requireManager, loadTaskForMember };

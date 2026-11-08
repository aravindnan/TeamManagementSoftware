const { getProject, getTask } = require("../db/queries");
const { notFound, forbidden } = require("./AppError");

const idEq = (a, b) => String(a && a._id ? a._id : a) === String(b && b._id ? b._id : b);
const isManager = (project, userId) => idEq(project.projectManager, userId);
const isMember = (project, userId) =>
  isManager(project, userId) || (project.projectMembers || []).some((m) => idEq(m, userId));

/** Loads a project in API shape (relations as id lists), or throws 404. */
const loadProject = async (projectId) => {
  const project = await getProject(projectId);
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
  const task = await getTask(taskId);
  if (!task) throw notFound("Task not found");
  const project = await getProject(task.project);
  if (!project) throw notFound("Project not found");
  requireMember(project, userId);
  return { task, project };
};

module.exports = { idEq, isManager, isMember, loadProject, requireMember, requireManager, loadTaskForMember };

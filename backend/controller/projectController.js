const Project = require("../model/project");
const User = require("../model/user");
const Task = require("../model/task");
const Comment = require("../model/comment");
const asyncHandler = require("../utils/asyncHandler");
const { notFound, badRequest, conflict, forbidden } = require("../utils/AppError");
const { PUBLIC_USER_FIELDS, idEq, isManager, isMember, loadProject, requireMember, requireManager } = require("../utils/access");
const { deleteTasksCascade } = require("../utils/cascade");
const { assessProject } = require("../utils/risk");
const Activity = require("../model/activity");
const Notification = require("../model/notification");
const { logActivity, fullName, excerpt } = require("../utils/activity");

// ----- GET -----
exports.get_all_projects = asyncHandler(async (req, res) => {
  res.status(200).json(await Project.find({ projectMembers: req.user.id }).sort({ createdAt: -1 }));
});

exports.get_project_by_id = asyncHandler(async (req, res) => {
  const project = await Project.findById(req.params.projectId)
    .populate("allTasks")
    .populate("projectManager", PUBLIC_USER_FIELDS)
    .populate("projectMembers", PUBLIC_USER_FIELDS)
    .populate("projectComments");
  if (!project) throw notFound("Project not found");
  requireMember(project, req.user.id);
  res.status(200).json(project);
});

exports.get_project_members_by_id = asyncHandler(async (req, res) => {
  const project = await loadProject(req.params.projectId, Project.findById(req.params.projectId).populate("projectMembers", PUBLIC_USER_FIELDS));
  requireMember(project, req.user.id);
  res.status(200).json(project.projectMembers);
});

exports.get_all_tasks_by_project_id = asyncHandler(async (req, res) => {
  const project = await loadProject(req.params.projectId);
  requireMember(project, req.user.id);
  res.status(200).json(await Task.find({ project: project._id }));
});

exports.get_project_overall_performance_by_id = asyncHandler(async (req, res) => {
  const project = await loadProject(req.params.projectId);
  requireMember(project, req.user.id);
  const [total, completed] = await Promise.all([
    Task.countDocuments({ project: project._id }),
    Task.countDocuments({ project: project._id, taskStatus: "Completed" }),
  ]);
  const overallPerformance = total === 0 ? 0 : Math.round((completed / total) * 100);
  res.status(200).json({ overallPerformance, totalTasks: total, completedTasks: completed });
});

exports.get_project_activity_by_id = asyncHandler(async (req, res) => {
  const project = await loadProject(req.params.projectId);
  requireMember(project, req.user.id);
  const { before, category, limit } = req.query;

  const filter = { project: project._id };
  if (category) filter.category = category;
  if (before) filter._id = { $lt: before }; // cursor = _id of the last item already shown

  const rows = await Activity.find(filter).sort({ _id: -1 }).limit(limit + 1).lean();
  const hasMore = rows.length > limit;
  const items = hasMore ? rows.slice(0, limit) : rows;
  res.status(200).json({ items, nextCursor: hasMore ? String(items[items.length - 1]._id) : null });
});

exports.get_project_risk_by_id = asyncHandler(async (req, res) => {
  const project = await loadProject(req.params.projectId);
  requireMember(project, req.user.id);
  const tasks = await Task.find({ project: project._id }).lean();
  res.status(200).json(assessProject(tasks));
});

// ----- POST -----
exports.add_new_task_to_project_by_id = asyncHandler(async (req, res) => {
  const project = await loadProject(req.params.projectId);
  requireManager(project, req.user.id);
  const { taskTitle, taskDescription, taskPriority, dueDate, assignedTo } = req.body;

  // Validate everything before writing anything.
  if (!isMember(project, assignedTo)) throw badRequest("Assignee must be a member of the project");

  const task = await Task.create({
    taskTitle,
    taskDescription,
    taskPriority,
    dueDate,
    assignedOn: new Date().toISOString(),
    project: project._id,
    assignedBy: req.user.id,
    assignedTo,
  });
  await Promise.all([
    Project.updateOne({ _id: project._id }, { $push: { allTasks: task._id } }),
    User.updateOne({ _id: assignedTo }, { $push: { allTasks: task._id } }),
  ]);
  const assignee = await User.findById(assignedTo).select("firstName lastName").lean();
  await logActivity(req.user.id, project._id, "task.created", {
    task: task._id,
    data: { title: taskTitle, priority: taskPriority, dueDate, assigneeName: fullName(assignee) },
    notify: [assignedTo],
  });
  res.status(201).json({ message: "New task added to the project successfully", taskId: task._id, status: true });
});

exports.add_member_to_project_by_id = asyncHandler(async (req, res) => {
  const project = await loadProject(req.params.projectId);
  requireManager(project, req.user.id);
  const { memberId } = req.body;

  const newMember = await User.findById(memberId).select("firstName lastName").lean();
  if (!newMember) throw notFound("User not found");
  if (isMember(project, memberId)) throw badRequest("User is already a member of the project");

  await Promise.all([
    Project.updateOne({ _id: project._id }, { $addToSet: { projectMembers: memberId } }),
    User.updateOne({ _id: memberId }, { $addToSet: { involvedProjects: project._id } }),
  ]);
  await logActivity(req.user.id, project._id, "member.added", { data: { memberName: fullName(newMember) }, notify: [memberId] });
  res.status(200).json({ message: "Member added to the project successfully", project: await Project.findById(project._id) });
});

exports.add_new_media_to_project = asyncHandler(async (req, res) => {
  const project = await loadProject(req.params.projectId);
  requireMember(project, req.user.id);
  const items = req.body.mediaDataArray.map((m) => ({ ...m, uploadedBy: req.user.id }));
  await Project.updateOne({ _id: project._id }, { $push: { attachedMediaURLSet: { $each: items } } });
  await logActivity(req.user.id, project._id, "media.added", { data: { names: items.map((m) => m.mediaName || "file"), scope: "project" } });
  res.status(200).json({ message: "Media added to project", addSuccess: true });
});

exports.add_comment_by_project_id = asyncHandler(async (req, res) => {
  const project = await loadProject(req.params.projectId);
  requireMember(project, req.user.id);
  const sender = await User.findById(req.user.id).select("firstName lastName");
  const comment = await Comment.create({
    senderName: `${sender.firstName} ${sender.lastName}`.trim(),
    senderId: req.user.id,
    messageContent: req.body.messageContent,
  });
  await Project.updateOne({ _id: project._id }, { $push: { projectComments: comment._id } });
  await logActivity(req.user.id, project._id, "comment.project", { data: { excerpt: excerpt(comment.messageContent) } });
  res.status(200).json({ message: "Comment added successfully", comment, addStatus: true });
});

// ----- PUT -----
exports.edit_project_by_id = asyncHandler(async (req, res) => {
  const project = await loadProject(req.params.projectId);
  requireManager(project, req.user.id);
  const { projectName, projectDescription, projectStatus } = req.body;
  const before = { projectName: project.projectName, projectDescription: project.projectDescription, projectStatus: project.projectStatus };
  Object.assign(project, { projectName, projectDescription, projectStatus });
  await project.save();
  const changes = [];
  if (before.projectName !== project.projectName) changes.push({ field: "name", from: before.projectName, to: project.projectName });
  if (before.projectStatus !== project.projectStatus) changes.push({ field: "status", from: before.projectStatus, to: project.projectStatus });
  if ((before.projectDescription || "") !== (project.projectDescription || "")) changes.push({ field: "description" });
  if (changes.length) await logActivity(req.user.id, project._id, "project.updated", { data: { changes } });
  res.status(200).json({ message: "Project updated successfully", status: true });
});

// ----- DELETE -----
exports.remove_member_from_project_by_id = asyncHandler(async (req, res) => {
  const project = await loadProject(req.params.projectId);
  requireManager(project, req.user.id);
  const { memberId } = req.body;

  const leaver = await User.findById(memberId).select("firstName lastName").lean();
  if (isManager(project, memberId)) throw badRequest("The project manager cannot be removed");
  if (!isMember(project, memberId)) throw badRequest("User is not a member of the project");

  // Hand the leaver's tasks in this project to the manager so nothing is orphaned.
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
  await logActivity(req.user.id, project._id, "member.removed", {
    data: { memberName: fullName(leaver), reassigned: orphanIds.length },
    notify: [memberId],
  });
  res.status(200).json({ message: "Member removed from the project successfully", deleteStatus: true });
});

exports.delete_project_by_id = asyncHandler(async (req, res) => {
  const project = await loadProject(req.params.projectId);
  requireManager(project, req.user.id);

  await deleteTasksCascade(project.allTasks);
  await Promise.all([
    Comment.deleteMany({ _id: { $in: project.projectComments } }),
    User.updateMany({ _id: { $in: project.projectMembers } }, { $pull: { involvedProjects: project._id } }),
    User.updateOne({ _id: project.projectManager }, { $pull: { myProjects: project._id } }),
    Activity.deleteMany({ project: project._id }),
    Notification.deleteMany({ project: project._id }),
    Project.deleteOne({ _id: project._id }),
  ]);
  res.status(200).json({ message: "Project deleted successfully", deleteStatus: true });
});

exports.remove_media_from_project = asyncHandler(async (req, res) => {
  const project = await loadProject(req.params.projectId);
  requireMember(project, req.user.id);
  const item = project.attachedMediaURLSet.find((m) => m.mediaURL === req.body.mediaURL);
  if (!item) throw notFound("Media not found in Project");
  if (!isManager(project, req.user.id) && item.uploadedBy && !idEq(item.uploadedBy, req.user.id)) {
    throw forbidden("Only the uploader or the project manager can remove this file");
  }
  const removedName = item.mediaName || "file";
  item.deleteOne();
  await project.save();
  await logActivity(req.user.id, project._id, "media.removed", { data: { names: [removedName], scope: "project" } });
  res.status(200).json({ message: "Media removed from Project successfully", deleteStatus: true });
});

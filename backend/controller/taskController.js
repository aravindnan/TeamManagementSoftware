const Task = require("../model/task");
const User = require("../model/user");
const Project = require("../model/project");
const Comment = require("../model/comment");
const asyncHandler = require("../utils/asyncHandler");
const { notFound, forbidden, badRequest } = require("../utils/AppError");
const { PUBLIC_USER_FIELDS, idEq, isManager, isMember, loadTaskForMember } = require("../utils/access");
const { deleteTasksCascade } = require("../utils/cascade");
const { logActivity, logTaskEdit, excerpt, fullName } = require("../utils/activity");

const MAX_SUBTASKS = 50;

const isOwnerOfTask = (task, project, userId) =>
  isManager(project, userId) || idEq(task.assignedBy, userId) || idEq(task.assignedTo, userId);

exports.get_task_by_id = asyncHandler(async (req, res) => {
  await loadTaskForMember(req.params.taskId, req.user.id);
  const task = await Task.findById(req.params.taskId)
    .populate("project")
    .populate("assignedBy", PUBLIC_USER_FIELDS)
    .populate("assignedTo", PUBLIC_USER_FIELDS)
    .populate("taskComments");
  res.status(200).json(task);
});

exports.edit_task_by_id = asyncHandler(async (req, res) => {
  const { task, project } = await loadTaskForMember(req.params.taskId, req.user.id);
  if (!isOwnerOfTask(task, project, req.user.id)) throw forbidden("You cannot edit this task");
  const { taskTitle, taskDescription, taskPriority, taskStatus, dueDate } = req.body;
  const before = {
    taskTitle: task.taskTitle, taskDescription: task.taskDescription, taskPriority: task.taskPriority,
    taskStatus: task.taskStatus, dueDate: task.dueDate,
  };
  Object.assign(task, { taskTitle, taskDescription, taskPriority, taskStatus });
  if (dueDate !== undefined) task.dueDate = dueDate;
  await task.save();
  await logTaskEdit(req.user.id, task, before);
  res.status(200).json({ message: "Task edited successfully", editStatus: true });
});

// Partial update: only the fields that were sent change. Reassigning is stricter than editing.
exports.patch_task_by_id = asyncHandler(async (req, res) => {
  const { task, project } = await loadTaskForMember(req.params.taskId, req.user.id);
  if (!isOwnerOfTask(task, project, req.user.id)) throw forbidden("You cannot edit this task");
  const body = req.body;

  const previousAssignee = String(task.assignedTo);
  const reassigning = body.assignedTo !== undefined && String(body.assignedTo) !== previousAssignee;
  if (reassigning) {
    if (!isManager(project, req.user.id) && !idEq(task.assignedBy, req.user.id)) {
      throw forbidden("Only the project manager or the task creator can reassign a task");
    }
    if (!isMember(project, body.assignedTo)) throw badRequest("Assignee must be a member of the project");
  }

  const before = {
    taskTitle: task.taskTitle, taskDescription: task.taskDescription, taskPriority: task.taskPriority,
    taskStatus: task.taskStatus, dueDate: task.dueDate, labels: [...task.labels], estimateHours: task.estimateHours,
  };

  for (const field of ["taskTitle", "taskDescription", "taskPriority", "taskStatus", "labels"]) {
    if (body[field] !== undefined) task[field] = body[field];
  }
  if (body.dueDate !== undefined) task.dueDate = body.dueDate === null || body.dueDate === "" ? undefined : body.dueDate;
  if (body.estimateHours !== undefined) task.estimateHours = body.estimateHours === null ? undefined : body.estimateHours;
  if (reassigning) task.assignedTo = body.assignedTo;
  await task.save();

  if (reassigning) {
    await Promise.all([
      User.updateOne({ _id: previousAssignee }, { $pull: { allTasks: task._id } }),
      User.updateOne({ _id: task.assignedTo }, { $addToSet: { allTasks: task._id } }),
    ]);
    const people = await User.find({ _id: { $in: [previousAssignee, task.assignedTo] } }).select("firstName lastName").lean();
    const name = (id) => fullName(people.find((p) => String(p._id) === String(id)));
    await logActivity(req.user.id, task.project, "task.reassigned", {
      task: task._id,
      data: { title: task.taskTitle, from: name(previousAssignee), to: name(task.assignedTo) },
      notify: [task.assignedTo, previousAssignee, task.assignedBy],
    });
  }
  await logTaskEdit(req.user.id, task, before);

  res.status(200).json({ message: "Task updated", editStatus: true, task });
});

exports.add_subtask = asyncHandler(async (req, res) => {
  const { task, project } = await loadTaskForMember(req.params.taskId, req.user.id);
  if (!isOwnerOfTask(task, project, req.user.id)) throw forbidden("You cannot edit this task");
  if (task.subtasks.length >= MAX_SUBTASKS) throw badRequest(`A task can have at most ${MAX_SUBTASKS} sub-tasks`);
  task.subtasks.push({ title: req.body.title });
  await task.save();
  res.status(201).json({ message: "Sub-task added", subtasks: task.subtasks });
});

exports.update_subtask = asyncHandler(async (req, res) => {
  const { task, project } = await loadTaskForMember(req.params.taskId, req.user.id);
  if (!isOwnerOfTask(task, project, req.user.id)) throw forbidden("You cannot edit this task");
  const sub = task.subtasks.id(req.params.subtaskId);
  if (!sub) throw notFound("Sub-task not found");
  if (req.body.title !== undefined) sub.title = req.body.title;
  if (req.body.done !== undefined && req.body.done !== sub.done) {
    sub.done = req.body.done;
    sub.completedAt = req.body.done ? new Date() : undefined;
  }
  await task.save();
  res.status(200).json({ message: "Sub-task updated", subtasks: task.subtasks });
});

exports.delete_subtask = asyncHandler(async (req, res) => {
  const { task, project } = await loadTaskForMember(req.params.taskId, req.user.id);
  if (!isOwnerOfTask(task, project, req.user.id)) throw forbidden("You cannot edit this task");
  const sub = task.subtasks.id(req.params.subtaskId);
  if (!sub) throw notFound("Sub-task not found");
  sub.deleteOne();
  await task.save();
  res.status(200).json({ message: "Sub-task removed", subtasks: task.subtasks });
});

exports.change_task_status_by_id = asyncHandler(async (req, res) => {
  const { task, project } = await loadTaskForMember(req.params.taskId, req.user.id);
  if (!isOwnerOfTask(task, project, req.user.id)) throw forbidden("You cannot change this task's status");
  const before = { taskStatus: task.taskStatus };
  task.taskStatus = req.body.newStatus;
  await task.save();
  await logTaskEdit(req.user.id, task, { ...before, taskTitle: task.taskTitle, taskPriority: task.taskPriority, dueDate: task.dueDate, taskDescription: task.taskDescription });
  res.status(200).json({ message: "Task status changed successfully", updateStatus: true });
});

exports.add_comment_by_task_id = asyncHandler(async (req, res) => {
  const { task } = await loadTaskForMember(req.params.taskId, req.user.id);
  const sender = await User.findById(req.user.id).select("firstName lastName");
  const comment = await Comment.create({
    senderName: `${sender.firstName} ${sender.lastName}`.trim(),
    senderId: req.user.id,
    messageContent: req.body.messageContent,
  });
  await Task.updateOne({ _id: task._id }, { $push: { taskComments: comment._id } });
  await logActivity(req.user.id, task.project, "comment.task", {
    task: task._id,
    data: { title: task.taskTitle, excerpt: excerpt(comment.messageContent) },
    notify: [task.assignedTo, task.assignedBy],
  });
  res.status(200).json({ message: "Comment added successfully", comment, addStatus: true });
});

exports.delete_task_by_id = asyncHandler(async (req, res) => {
  const { task, project } = await loadTaskForMember(req.params.taskId, req.user.id);
  if (!isManager(project, req.user.id) && !idEq(task.assignedBy, req.user.id)) {
    throw forbidden("Only the project manager or the task creator can delete this task");
  }
  await Project.updateOne({ _id: task.project }, { $pull: { allTasks: task._id } });
  await Comment.deleteMany({ _id: { $in: task.taskComments } });
  await deleteTasksCascade([task._id]);
  await logActivity(req.user.id, task.project, "task.deleted", { data: { title: task.taskTitle }, notify: [task.assignedTo] });
  res.status(200).json({ message: "Task deleted successfully", deleteStatus: true });
});

exports.add_new_media_to_task = asyncHandler(async (req, res) => {
  const { task } = await loadTaskForMember(req.params.taskId, req.user.id);
  const items = req.body.mediaDataArray.map((m) => ({ ...m, uploadedBy: req.user.id }));
  await Task.updateOne({ _id: task._id }, { $push: { attachedMediaURLSet: { $each: items } } });
  await logActivity(req.user.id, task.project, "media.added", { task: task._id, data: { title: task.taskTitle, names: items.map((m) => m.mediaName || "file"), scope: "task" } });
  res.status(200).json({ message: "Media added to Task", addSuccess: true });
});

exports.remove_media_from_task = asyncHandler(async (req, res) => {
  const { task, project } = await loadTaskForMember(req.params.taskId, req.user.id);
  const item = task.attachedMediaURLSet.find((m) => m.mediaURL === req.body.mediaURL);
  if (!item) throw notFound("Media not found in task");
  if (!isOwnerOfTask(task, project, req.user.id) && !(item.uploadedBy && idEq(item.uploadedBy, req.user.id))) {
    throw forbidden("You cannot remove this file");
  }
  const removedName = item.mediaName || "file";
  item.deleteOne();
  await task.save();
  await logActivity(req.user.id, task.project, "media.removed", { task: task._id, data: { title: task.taskTitle, names: [removedName], scope: "task" } });
  res.status(200).json({ message: "Media removed from task successfully", deleteStatus: true });
});

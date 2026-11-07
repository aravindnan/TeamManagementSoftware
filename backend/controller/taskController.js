const Task = require("../model/task");
const User = require("../model/user");
const Project = require("../model/project");
const Comment = require("../model/comment");
const asyncHandler = require("../utils/asyncHandler");
const { notFound, forbidden } = require("../utils/AppError");
const { PUBLIC_USER_FIELDS, idEq, isManager, loadTaskForMember } = require("../utils/access");
const { deleteTasksCascade } = require("../utils/cascade");
const { logActivity, logTaskEdit, excerpt } = require("../utils/activity");

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

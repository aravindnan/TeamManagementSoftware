const { prisma } = require("../db/prisma");
const S = require("../db/serialize");
const { getTask, getTaskPopulated } = require("../db/queries");
const asyncHandler = require("../utils/asyncHandler");
const { notFound, forbidden, badRequest } = require("../utils/AppError");
const { idEq, isManager, isMember, loadTaskForMember } = require("../utils/access");
const { logActivity, logTaskEdit, excerpt, fullName } = require("../utils/activity");

const MAX_SUBTASKS = 50;

const isOwnerOfTask = (task, project, userId) =>
  isManager(project, userId) || idEq(task.assignedBy, userId) || idEq(task.assignedTo, userId);

// "Last activity" for risk scoring is the task row's updatedAt, so anything that happens on a task bumps it.
const touchTask = (id) => prisma.task.update({ where: { id }, data: { updatedAt: new Date() } });

/** Entering "Completed" stamps completedAt; leaving it clears the stamp. Unchanged status leaves it alone. */
const statusData = (task, newStatus) => {
  if (newStatus === undefined || newStatus === task.taskStatus) return {};
  return { taskStatus: newStatus, completedAt: newStatus === "Completed" ? new Date() : null };
};

const snapshot = (task) => ({
  taskTitle: task.taskTitle, taskDescription: task.taskDescription, taskPriority: task.taskPriority,
  taskStatus: task.taskStatus, dueDate: task.dueDate,
});

exports.get_task_by_id = asyncHandler(async (req, res) => {
  await loadTaskForMember(req.params.taskId, req.user.id);
  res.status(200).json(await getTaskPopulated(req.params.taskId));
});

exports.edit_task_by_id = asyncHandler(async (req, res) => {
  const { task, project } = await loadTaskForMember(req.params.taskId, req.user.id);
  if (!isOwnerOfTask(task, project, req.user.id)) throw forbidden("You cannot edit this task");
  const { taskTitle, taskDescription, taskPriority, taskStatus, dueDate } = req.body;
  const before = snapshot(task);
  const data = { taskTitle, taskDescription, taskPriority, ...statusData(task, taskStatus) };
  if (dueDate !== undefined) data.dueDate = dueDate;
  await prisma.task.update({ where: { id: task._id }, data });
  await logTaskEdit(req.user.id, await getTask(task._id), before);
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

  const before = { ...snapshot(task), labels: [...task.labels], estimateHours: task.estimateHours };

  const data = { ...statusData(task, body.taskStatus) };
  for (const field of ["taskTitle", "taskDescription", "taskPriority", "labels"]) {
    if (body[field] !== undefined) data[field] = body[field];
  }
  if (body.dueDate !== undefined) data.dueDate = body.dueDate === null || body.dueDate === "" ? null : body.dueDate;
  if (body.estimateHours !== undefined) data.estimateHours = body.estimateHours;
  if (reassigning) data.assignedToId = body.assignedTo;
  await prisma.task.update({ where: { id: task._id }, data });
  const updated = await getTask(task._id);

  if (reassigning) {
    const people = await prisma.user.findMany({
      where: { id: { in: [previousAssignee, updated.assignedTo] } },
      select: { id: true, firstName: true, lastName: true },
    });
    const name = (id) => fullName(people.find((p) => p.id === String(id)));
    await logActivity(req.user.id, updated.project, "task.reassigned", {
      task: updated._id,
      data: { title: updated.taskTitle, from: name(previousAssignee), to: name(updated.assignedTo) },
      notify: [updated.assignedTo, previousAssignee, updated.assignedBy],
    });
  }
  await logTaskEdit(req.user.id, updated, before);

  res.status(200).json({ message: "Task updated", editStatus: true, task: updated });
});

exports.add_subtask = asyncHandler(async (req, res) => {
  const { task, project } = await loadTaskForMember(req.params.taskId, req.user.id);
  if (!isOwnerOfTask(task, project, req.user.id)) throw forbidden("You cannot edit this task");
  if (task.subtasks.length >= MAX_SUBTASKS) throw badRequest(`A task can have at most ${MAX_SUBTASKS} sub-tasks`);
  await prisma.subtask.create({ data: { taskId: task._id, title: req.body.title } });
  await touchTask(task._id);
  res.status(201).json({ message: "Sub-task added", subtasks: (await getTask(task._id)).subtasks });
});

exports.update_subtask = asyncHandler(async (req, res) => {
  const { task, project } = await loadTaskForMember(req.params.taskId, req.user.id);
  if (!isOwnerOfTask(task, project, req.user.id)) throw forbidden("You cannot edit this task");
  const sub = task.subtasks.find((s) => s._id === req.params.subtaskId);
  if (!sub) throw notFound("Sub-task not found");
  const data = {};
  if (req.body.title !== undefined) data.title = req.body.title;
  if (req.body.done !== undefined && req.body.done !== sub.done) {
    data.done = req.body.done;
    data.completedAt = req.body.done ? new Date() : null;
  }
  await prisma.subtask.update({ where: { id: sub._id }, data });
  await touchTask(task._id);
  res.status(200).json({ message: "Sub-task updated", subtasks: (await getTask(task._id)).subtasks });
});

exports.delete_subtask = asyncHandler(async (req, res) => {
  const { task, project } = await loadTaskForMember(req.params.taskId, req.user.id);
  if (!isOwnerOfTask(task, project, req.user.id)) throw forbidden("You cannot edit this task");
  const sub = task.subtasks.find((s) => s._id === req.params.subtaskId);
  if (!sub) throw notFound("Sub-task not found");
  await prisma.subtask.delete({ where: { id: sub._id } });
  await touchTask(task._id);
  res.status(200).json({ message: "Sub-task removed", subtasks: (await getTask(task._id)).subtasks });
});

exports.change_task_status_by_id = asyncHandler(async (req, res) => {
  const { task, project } = await loadTaskForMember(req.params.taskId, req.user.id);
  if (!isOwnerOfTask(task, project, req.user.id)) throw forbidden("You cannot change this task's status");
  await prisma.task.update({ where: { id: task._id }, data: statusData(task, req.body.newStatus) });
  await logTaskEdit(req.user.id, await getTask(task._id), snapshot(task));
  res.status(200).json({ message: "Task status changed successfully", updateStatus: true });
});

exports.add_comment_by_task_id = asyncHandler(async (req, res) => {
  const { task } = await loadTaskForMember(req.params.taskId, req.user.id);
  const sender = await prisma.user.findUnique({ where: { id: req.user.id }, select: { firstName: true, lastName: true } });
  const comment = await prisma.comment.create({
    data: {
      senderName: `${sender.firstName} ${sender.lastName}`.trim(),
      senderId: req.user.id,
      messageContent: req.body.messageContent,
      taskId: task._id,
    },
  });
  await touchTask(task._id);
  await logActivity(req.user.id, task.project, "comment.task", {
    task: task._id,
    data: { title: task.taskTitle, excerpt: excerpt(comment.messageContent) },
    notify: [task.assignedTo, task.assignedBy],
  });
  res.status(200).json({ message: "Comment added successfully", comment: S.comment(comment), addStatus: true });
});

exports.delete_task_by_id = asyncHandler(async (req, res) => {
  const { task, project } = await loadTaskForMember(req.params.taskId, req.user.id);
  if (!isManager(project, req.user.id) && !idEq(task.assignedBy, req.user.id)) {
    throw forbidden("Only the project manager or the task creator can delete this task");
  }
  await prisma.task.delete({ where: { id: task._id } }); // comments, files and sub-tasks cascade
  await logActivity(req.user.id, task.project, "task.deleted", { data: { title: task.taskTitle }, notify: [task.assignedTo] });
  res.status(200).json({ message: "Task deleted successfully", deleteStatus: true });
});

exports.add_new_media_to_task = asyncHandler(async (req, res) => {
  const { task } = await loadTaskForMember(req.params.taskId, req.user.id);
  const items = req.body.mediaDataArray.map((m) => ({ ...m, uploadedBy: req.user.id }));
  await prisma.media.createMany({ data: items.map((m) => ({ ...m, taskId: task._id })) });
  await touchTask(task._id);
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
  await prisma.media.delete({ where: { id: item._id } });
  await touchTask(task._id);
  await logActivity(req.user.id, task.project, "media.removed", { task: task._id, data: { title: task.taskTitle, names: [removedName], scope: "task" } });
  res.status(200).json({ message: "Media removed from task successfully", deleteStatus: true });
});

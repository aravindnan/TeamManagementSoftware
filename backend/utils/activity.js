const Activity = require("../model/activity");
const User = require("../model/user");
const { isTest } = require("../config/env");

const CATEGORY = {
  "project.created": "project",
  "project.updated": "project",
  "task.created": "task",
  "task.status_changed": "task",
  "task.updated": "task",
  "task.deleted": "task",
  "comment.project": "comment",
  "comment.task": "comment",
  "media.added": "file",
  "media.removed": "file",
  "member.added": "member",
  "member.removed": "member",
};

const fullName = (u) => (u ? `${u.firstName || ""} ${u.lastName || ""}`.trim() : "") || "Someone";
const excerpt = (text, n = 90) => (text.length > n ? `${text.slice(0, n - 1).trimEnd()}…` : text);

/**
 * Records an activity entry. Never throws: the feed is secondary to the action that triggered it,
 * so a logging failure must not turn a successful change into an error response.
 */
async function logActivity(actorId, projectId, verb, { task, data = {} } = {}) {
  try {
    const actor = await User.findById(actorId).select("firstName lastName").lean();
    await Activity.create({
      project: projectId,
      actor: actorId,
      actorName: fullName(actor),
      verb,
      category: CATEGORY[verb],
      task,
      data,
    });
  } catch (err) {
    if (!isTest) console.error(`Could not record activity "${verb}":`, err.message);
  }
}

const sameValue = (a, b) => (a ?? "") === (b ?? "");

/** Diffs a task before/after an edit and logs a status change and/or a field update. */
async function logTaskEdit(actorId, task, before) {
  const title = task.taskTitle;
  if (before.taskStatus !== task.taskStatus) {
    await logActivity(actorId, task.project, "task.status_changed", {
      task: task._id,
      data: { title, from: before.taskStatus, to: task.taskStatus },
    });
  }
  const changes = [];
  for (const [field, label] of [["taskTitle", "title"], ["taskPriority", "priority"], ["dueDate", "due date"]]) {
    if (!sameValue(before[field], task[field])) changes.push({ field: label, from: before[field] ?? null, to: task[field] ?? null });
  }
  if (!sameValue(before.taskDescription, task.taskDescription)) changes.push({ field: "description" });
  if (changes.length) await logActivity(actorId, task.project, "task.updated", { task: task._id, data: { title, changes } });
}

module.exports = { logActivity, logTaskEdit, fullName, excerpt, CATEGORY };

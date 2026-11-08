const { prisma } = require("../db/prisma");
const { isTest } = require("../config/env");

const CATEGORY = {
  "project.created": "project",
  "project.updated": "project",
  "task.created": "task",
  "task.status_changed": "task",
  "task.updated": "task",
  "task.deleted": "task",
  "task.reassigned": "task",
  "comment.project": "comment",
  "comment.task": "comment",
  "media.added": "file",
  "media.removed": "file",
  "member.added": "member",
  "member.removed": "member",
};

const fullName = (u) => (u ? `${u.firstName || ""} ${u.lastName || ""}`.trim() : "") || "Someone";
const excerpt = (text, n = 90) => (text.length > n ? `${text.slice(0, n - 1).trimEnd()}…` : text);

/** Distinct recipient ids, never including the person who caused the event. */
const recipientsExcluding = (actorId, ids = []) =>
  [...new Set(ids.filter(Boolean).map((id) => String(id && id._id ? id._id : id)))].filter((id) => id !== String(actorId));

/**
 * Records an activity entry and, when `notify` lists users, one notification per recipient.
 * Never throws: both are secondary to the action that triggered them, so a failure here must not
 * turn a successful change into an error response.
 */
async function logActivity(actorId, projectId, verb, { task, data = {}, notify = [] } = {}) {
  try {
    const actor = await prisma.user.findUnique({ where: { id: actorId }, select: { firstName: true, lastName: true } });
    const actorName = fullName(actor);
    await prisma.activity.create({
      data: { projectId, actorId, actorName, verb, category: CATEGORY[verb], taskId: task ? String(task) : null, data },
    });

    const recipients = recipientsExcluding(actorId, notify);
    if (recipients.length) {
      const project = await prisma.project.findUnique({ where: { id: projectId }, select: { projectName: true } });
      // A recipient whose account is gone meanwhile would violate the foreign key: only notify real users.
      const existing = await prisma.user.findMany({ where: { id: { in: recipients } }, select: { id: true } });
      await prisma.notification.createMany({
        data: existing.map(({ id }) => ({
          userId: id, type: verb, actorName, projectId, projectName: project?.projectName, taskId: task ? String(task) : null, data,
        })),
      });
    }
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
      notify: [task.assignedTo, task.assignedBy],
    });
  }
  const changes = [];
  for (const [field, label] of [["taskTitle", "title"], ["taskPriority", "priority"], ["dueDate", "due date"]]) {
    if (!sameValue(before[field], task[field])) changes.push({ field: label, from: before[field] ?? null, to: task[field] ?? null });
  }
  if (!sameValue(before.taskDescription, task.taskDescription)) changes.push({ field: "description" });
  // Only compared when the caller captured them, so older call sites are unaffected.
  if ("labels" in before && (before.labels || []).join("|") !== (task.labels || []).join("|")) {
    changes.push({ field: "labels", from: before.labels || [], to: task.labels || [] });
  }
  if ("estimateHours" in before && !sameValue(before.estimateHours, task.estimateHours)) {
    changes.push({ field: "estimate", from: before.estimateHours ?? null, to: task.estimateHours ?? null });
  }
  if (changes.length) {
    await logActivity(actorId, task.project, "task.updated", {
      task: task._id,
      data: { title, changes },
      notify: [task.assignedTo, task.assignedBy],
    });
  }
}

module.exports = { logActivity, logTaskEdit, fullName, excerpt, CATEGORY };

// The one place where database rows become the JSON the web app has always received.
// Rows use relational names (`projectManagerId`, `members`, ...); the API keeps the document-style
// names and `_id` strings it exposed before the move to PostgreSQL, and leaves out unset fields
// the way the old documents did.
const compact = (obj) => Object.fromEntries(Object.entries(obj).filter(([, v]) => v !== null && v !== undefined));
const ids = (rows) => rows.map((r) => r.id);

const PUBLIC_USER_SELECT = {
  id: true, firstName: true, lastName: true, username: true, email: true, role: true, bio: true, profilePictureURL: true,
};

// Relations needed to render a project / task in full.
const PROJECT_INCLUDE = {
  members: { select: { userId: true }, orderBy: [{ addedAt: "asc" }, { userId: "asc" }] },
  tasks: { select: { id: true }, orderBy: { id: "asc" } },
  comments: { orderBy: { id: "asc" } },
  media: { orderBy: { id: "asc" } },
};
const TASK_INCLUDE = {
  subtasks: { orderBy: { id: "asc" } },
  comments: { orderBy: { id: "asc" } },
  media: { orderBy: { id: "asc" } },
};

const userPublic = (u) =>
  u && compact({
    _id: u.id, firstName: u.firstName, lastName: u.lastName, username: u.username, email: u.email, role: u.role,
    bio: u.bio, profilePictureURL: u.profilePictureURL,
  });

const comment = (c) =>
  compact({ _id: c.id, senderName: c.senderName, messageContent: c.messageContent, senderId: c.senderId, timeStamp: c.timeStamp });

const media = (m) =>
  compact({ _id: m.id, mediaType: m.mediaType, mediaURL: m.mediaURL, mediaName: m.mediaName, mediaSize: m.mediaSize, uploadedBy: m.uploadedBy });

const subtask = (s) => compact({ _id: s.id, title: s.title, done: s.done, completedAt: s.completedAt, createdAt: s.createdAt });

/** A project row loaded with PROJECT_INCLUDE. Relations are rendered as id lists, like the old document. */
const project = (p, populate = {}) =>
  compact({
    _id: p.id,
    projectName: p.projectName,
    projectDescription: p.projectDescription,
    workspace: populate.workspace !== undefined ? populate.workspace : p.workspaceId,
    projectManager: populate.projectManager !== undefined ? populate.projectManager : p.projectManagerId,
    projectMembers: populate.projectMembers !== undefined ? populate.projectMembers : p.members.map((m) => m.userId),
    allTasks: populate.allTasks !== undefined ? populate.allTasks : ids(p.tasks),
    startDate: p.startDate,
    projectStatus: p.projectStatus,
    attachedMediaURLSet: p.media.map(media),
    projectComments: populate.projectComments !== undefined ? populate.projectComments : ids(p.comments),
    createdAt: p.createdAt,
    updatedAt: p.updatedAt,
  });

/** A task row loaded with TASK_INCLUDE. */
const task = (t, populate = {}) =>
  compact({
    _id: t.id,
    taskTitle: t.taskTitle,
    taskDescription: t.taskDescription,
    taskPriority: t.taskPriority,
    project: populate.project !== undefined ? populate.project : t.projectId,
    assignedBy: populate.assignedBy !== undefined ? populate.assignedBy : t.assignedById,
    assignedTo: populate.assignedTo !== undefined ? populate.assignedTo : t.assignedToId,
    taskStatus: t.taskStatus,
    completedAt: t.completedAt,
    dueDate: t.dueDate,
    assignedOn: t.assignedOn,
    labels: t.labels,
    estimateHours: t.estimateHours,
    subtasks: t.subtasks.map(subtask),
    attachedMediaURLSet: t.media.map(media),
    taskComments: populate.taskComments !== undefined ? populate.taskComments : ids(t.comments),
    createdAt: t.createdAt,
    updatedAt: t.updatedAt,
  });

const activity = (a) =>
  compact({
    _id: a.id, project: a.projectId, actor: a.actorId, actorName: a.actorName, verb: a.verb, category: a.category,
    task: a.taskId, data: a.data, createdAt: a.createdAt,
  });

const notification = (n) =>
  compact({
    _id: n.id, user: n.userId, type: n.type, actorName: n.actorName, project: n.projectId, projectName: n.projectName,
    task: n.taskId, data: n.data, readAt: n.readAt, createdAt: n.createdAt,
  });

module.exports = {
  compact, PUBLIC_USER_SELECT, PROJECT_INCLUDE, TASK_INCLUDE,
  userPublic, comment, media, subtask, project, task, activity, notification,
};

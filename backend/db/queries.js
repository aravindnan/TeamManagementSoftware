// Loaders that return rows already shaped for the API (see serialize.js). Every function takes an
// optional transaction client so callers can read inside the same transaction they write in.
const { prisma } = require("./prisma");
const S = require("./serialize");

const getProject = async (id, db = prisma) => {
  const row = await db.project.findUnique({ where: { id }, include: S.PROJECT_INCLUDE });
  return row && S.project(row);
};

const listProjects = async (where, db = prisma, orderBy = { id: "asc" }) =>
  (await db.project.findMany({ where, include: S.PROJECT_INCLUDE, orderBy })).map((p) => S.project(p));

const getTask = async (id, db = prisma) => {
  const row = await db.task.findUnique({ where: { id }, include: S.TASK_INCLUDE });
  return row && S.task(row);
};

const listTasks = async (where, db = prisma) =>
  (await db.task.findMany({ where, include: S.TASK_INCLUDE, orderBy: { id: "asc" } })).map((t) => S.task(t));

/** Project with its tasks, people, comments and workspace name filled in. */
const getProjectPopulated = async (id, db = prisma) => {
  const row = await db.project.findUnique({
    where: { id },
    include: {
      ...S.PROJECT_INCLUDE,
      members: { include: { user: { select: S.PUBLIC_USER_SELECT } }, orderBy: [{ addedAt: "asc" }, { userId: "asc" }] },
      tasks: { include: S.TASK_INCLUDE, orderBy: { id: "asc" } },
      manager: { select: S.PUBLIC_USER_SELECT },
      workspace: { select: { id: true, name: true } },
    },
  });
  if (!row) return null;
  return S.project(row, {
    allTasks: row.tasks.map((t) => S.task(t)),
    projectManager: S.userPublic(row.manager),
    projectMembers: row.members.map((m) => S.userPublic(m.user)),
    projectComments: row.comments.map(S.comment),
    workspace: row.workspace ? { _id: row.workspace.id, name: row.workspace.name } : undefined,
  });
};

/** Task with its project, creator, assignee and comments filled in. */
const getTaskPopulated = async (id, db = prisma) => {
  const row = await db.task.findUnique({
    where: { id },
    include: {
      ...S.TASK_INCLUDE,
      project: { include: S.PROJECT_INCLUDE },
      assignedBy: { select: S.PUBLIC_USER_SELECT },
      assignedTo: { select: S.PUBLIC_USER_SELECT },
    },
  });
  if (!row) return null;
  return S.task(row, {
    project: S.project(row.project),
    assignedBy: S.userPublic(row.assignedBy),
    assignedTo: S.userPublic(row.assignedTo),
    taskComments: row.comments.map(S.comment),
  });
};

/** The signed-in user's own record: everything but secrets, with their tasks and projects filled in. */
const getFullProfile = async (userId, db = prisma) => {
  const u = await db.user.findUnique({ where: { id: userId } });
  if (!u) return null;
  const [tasks, myProjects, involved] = await Promise.all([
    listTasks({ assignedToId: userId }, db),
    listProjects({ projectManagerId: userId }, db),
    listProjects({ members: { some: { userId } }, NOT: { projectManagerId: userId } }, db),
  ]);
  return S.compact({
    _id: u.id,
    username: u.username,
    email: u.email,
    emailVerified: u.emailVerified,
    firstName: u.firstName,
    lastName: u.lastName,
    role: u.role,
    dateOfBirth: u.dateOfBirth,
    lastLoginDate: u.lastLoginDate,
    allTasks: tasks,
    myProjects,
    involvedProjects: involved,
    profilePictureURL: u.profilePictureURL,
    bio: u.bio,
    createdAt: u.createdAt,
    updatedAt: u.updatedAt,
  });
};

const fullNameOf = (u) => (u ? `${u.firstName || ""} ${u.lastName || ""}`.trim() : "") || "Someone";

module.exports = { getProject, listProjects, getTask, listTasks, getProjectPopulated, getTaskPopulated, getFullProfile, fullNameOf };

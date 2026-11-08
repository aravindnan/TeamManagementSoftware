// One-off import of the old MongoDB data into PostgreSQL.
//
//   npm run migrate:mongo-to-postgres                # real run
//   npm run migrate:mongo-to-postgres -- --dry-run   # does everything, then rolls back
//
// Reads from MONGO_URI (or the legacy DB_USERNAME / DB_PASSWORD / DB_NAME / DB_HOST variables) and writes to
// DATABASE_URL. The Mongo database is only ever read.
//
// Properties:
//  - Ids are preserved (ObjectId hex strings), so links people already hold, and everything the frontend
//    remembers, keep working.
//  - Idempotent: rows are inserted with ON CONFLICT DO NOTHING keyed on the preserved id, so re-running adds
//    only what is missing and never overwrites rows that were changed in Postgres since.
//  - All-or-nothing: the whole import is one transaction.
//  - Relationships are rebuilt from the old arrays (projectMembers, workspace members, comments and files
//    embedded in projects/tasks). References to documents that no longer exist (the old database had no
//    foreign keys) are dropped or nulled rather than failing; every such case is counted in the report.
//  - The old denormalised back-reference arrays (User.allTasks / myProjects / involvedProjects,
//    Project.allTasks) are not imported: they are derived from the relations now.

const { isId } = require("../db/objectId");

const TABLES = ["users", "workspaces", "projects", "tasks", "comments", "activities", "notifications", "invites"];
const CATEGORIES = new Set(["project", "task", "comment", "file", "member"]);
const WORKSPACE_ROLES = new Set(["owner", "admin", "member"]);
const BATCH = 1000;

// ------------------------------------------------------------------ value helpers

const idOf = (v) => {
  if (v === null || v === undefined) return null;
  const s = String(v && v._id ? v._id : v);
  return isId(s) ? s.toLowerCase() : null;
};
const date = (v, fallback = null) => {
  if (v === null || v === undefined || v === "") return fallback;
  const d = v instanceof Date ? v : new Date(v);
  return Number.isNaN(d.getTime()) ? fallback : d;
};
const str = (v, fallback = null) => (v === null || v === undefined ? fallback : String(v));
const num = (v) => (typeof v === "number" && Number.isFinite(v) ? v : null);
const json = (v) => {
  if (v === null || v === undefined) return {};
  // Round-trips ObjectIds / Dates inside free-form data into plain JSON.
  return JSON.parse(JSON.stringify(v));
};
const chunks = (rows, n = BATCH) => {
  const out = [];
  for (let i = 0; i < rows.length; i += n) out.push(rows.slice(i, i + n));
  return out;
};

// ------------------------------------------------------------------ sources

/** Reads the collections straight from MongoDB. */
async function mongoSource(uri) {
  const { MongoClient } = require("mongodb");
  const client = new MongoClient(uri);
  await client.connect();
  const db = client.db();
  return {
    read: (name) => db.collection(name).find({}).toArray(),
    close: () => client.close(),
  };
}

/** In-memory documents: `{ users: [...], projects: [...] }`. Used by the tests. */
const fixtureSource = (data) => ({
  read: async (name) => data[name] || [],
  close: async () => {},
});

function legacyMongoUri(env = process.env) {
  if (env.MONGO_URI) return env.MONGO_URI;
  const { DB_USERNAME, DB_PASSWORD, DB_NAME } = env;
  if (!DB_USERNAME || !DB_PASSWORD || !DB_NAME) {
    throw new Error("Set MONGO_URI (or DB_USERNAME, DB_PASSWORD and DB_NAME) to the old MongoDB to read from.");
  }
  const host = env.DB_HOST || "cluster0.myusfay.mongodb.net";
  return `mongodb+srv://${encodeURIComponent(DB_USERNAME)}:${encodeURIComponent(DB_PASSWORD)}@${host}/${DB_NAME}?retryWrites=true&w=majority`;
}

// ------------------------------------------------------------------ the import

class DryRun extends Error {}

/**
 * @param source  { read(collectionName) -> Promise<doc[]> }
 * @param prisma  a PrismaClient (extended client from db/prisma.js is fine)
 * @param opts    { dryRun, log }
 * @returns       report: { [table]: { read, inserted, dropped } } plus `warnings`
 */
async function migrate(source, prisma, { dryRun = false, log = () => {} } = {}) {
  const docs = {};
  for (const name of TABLES) docs[name] = await source.read(name);

  const report = { warnings: [] };
  const table = (name) => (report[name] = report[name] || { read: 0, inserted: 0, dropped: 0 });
  const warn = (msg) => {
    if (report.warnings.length < 200) report.warnings.push(msg);
  };

  try {
    await prisma.$transaction(
      async (tx) => {
        const insert = async (name, delegate, rows) => {
          const t = table(name);
          for (const batch of chunks(rows)) {
            const res = await tx[delegate].createMany({ data: batch, skipDuplicates: true });
            t.inserted += res.count;
          }
        };

        // ---- users
        const userIds = new Set();
        const usedUsernames = new Set();
        const usedEmails = new Set();
        const usedGoogle = new Set();
        const userRows = [];
        table("users").read = docs.users.length;
        for (const u of docs.users) {
          const id = idOf(u._id);
          const email = str(u.email, "").trim().toLowerCase();
          const username = str(u.username, "").trim();
          if (!id || !email || !username || !u.password || !u.firstName) {
            table("users").dropped++;
            warn(`user ${u._id}: missing a required field, skipped`);
            continue;
          }
          if (usedUsernames.has(username) || usedEmails.has(email)) {
            table("users").dropped++;
            warn(`user ${u._id}: duplicate username or email, skipped`);
            continue;
          }
          usedUsernames.add(username);
          usedEmails.add(email);
          let googleId = str(u.googleId);
          if (googleId && usedGoogle.has(googleId)) googleId = null;
          if (googleId) usedGoogle.add(googleId);
          userIds.add(id);
          userRows.push({
            id, username, email, password: String(u.password), googleId,
            emailVerified: Boolean(u.emailVerified),
            tokenVersion: Number.isInteger(u.tokenVersion) ? u.tokenVersion : 0,
            firstName: String(u.firstName).trim(),
            lastName: str(u.lastName, "").trim(),
            role: str(u.role),
            dateOfBirth: str(u.dateOfBirth),
            lastLoginDate: date(u.lastLoginDate),
            profilePictureURL: str(u.profilePictureURL, ""),
            bio: str(u.bio, ""),
            createdAt: date(u.createdAt, new Date()),
            updatedAt: date(u.updatedAt, date(u.createdAt, new Date())),
          });
        }
        await insert("users", "user", userRows);
        const user = (v) => {
          const id = idOf(v);
          return id && userIds.has(id) ? id : null;
        };

        // ---- workspaces and their members
        const workspaceIds = new Set();
        const workspaceRows = [];
        const workspaceMemberRows = [];
        table("workspaces").read = docs.workspaces.length;
        for (const w of docs.workspaces) {
          const id = idOf(w._id);
          const ownerId = user(w.owner);
          if (!id || !ownerId || !w.name) {
            table("workspaces").dropped++;
            warn(`workspace ${w._id}: missing id, name or an existing owner, skipped`);
            continue;
          }
          workspaceIds.add(id);
          workspaceRows.push({
            id, name: String(w.name), ownerId,
            createdAt: date(w.createdAt, new Date()), updatedAt: date(w.updatedAt, date(w.createdAt, new Date())),
          });
          const seen = new Set();
          const add = (userId, role, joinedAt) => {
            if (!userId || seen.has(userId)) return;
            seen.add(userId);
            workspaceMemberRows.push({ workspaceId: id, userId, role, joinedAt });
          };
          add(ownerId, "owner", date((w.members || []).find((m) => user(m.user) === ownerId)?.joinedAt, date(w.createdAt, new Date())));
          for (const m of w.members || []) {
            const userId = user(m.user);
            if (!userId) warn(`workspace ${id}: member ${m.user} no longer exists, dropped`);
            // Exactly one owner: anybody else listed as owner becomes an admin.
            const role = WORKSPACE_ROLES.has(m.role) ? (m.role === "owner" && userId !== ownerId ? "admin" : m.role) : "member";
            add(userId, userId === ownerId ? "owner" : role, date(m.joinedAt, date(w.createdAt, new Date())));
          }
        }
        await insert("workspaces", "workspace", workspaceRows);
        await insert("workspace_members", "workspaceMember", workspaceMemberRows);

        // ---- projects, their members, comments and files
        const projectIds = new Set();
        const projectRows = [];
        const projectMemberRows = [];
        const commentRows = [];
        const mediaRows = [];
        const commentById = new Map(docs.comments.map((c) => [idOf(c._id), c]));
        const usedComments = new Set();
        table("projects").read = docs.projects.length;

        const commentsFor = (ids, owner) => {
          for (const cid of ids || []) {
            const key = idOf(cid);
            const c = key && commentById.get(key);
            if (!c || usedComments.has(key)) {
              if (!c) warn(`comment ${cid}: referenced but missing, dropped`);
              continue;
            }
            usedComments.add(key);
            if (!c.senderName || !c.messageContent) {
              warn(`comment ${key}: empty, dropped`);
              continue;
            }
            commentRows.push({
              id: key, senderName: String(c.senderName), messageContent: String(c.messageContent),
              senderId: user(c.senderId), timeStamp: date(c.timeStamp, new Date()), ...owner,
            });
          }
        };
        const mediaFor = (items, owner) => {
          for (const m of items || []) {
            const id = idOf(m._id);
            if (!id || !m.mediaURL) {
              warn(`media ${m._id}: missing id or URL, dropped`);
              continue;
            }
            mediaRows.push({
              id, mediaType: str(m.mediaType), mediaURL: String(m.mediaURL), mediaName: str(m.mediaName),
              mediaSize: num(m.mediaSize), uploadedBy: user(m.uploadedBy), ...owner,
            });
          }
        };

        for (const p of docs.projects) {
          const id = idOf(p._id);
          const managerId = user(p.projectManager);
          if (!id || !managerId || !p.projectName) {
            table("projects").dropped++;
            warn(`project ${p._id}: missing id, name or an existing manager, skipped (its tasks and feed are skipped too)`);
            continue;
          }
          projectIds.add(id);
          const created = date(p.createdAt, date(p.startDate, new Date()));
          const workspaceId = idOf(p.workspace);
          if (workspaceId && !workspaceIds.has(workspaceId)) warn(`project ${id}: workspace ${workspaceId} is gone, project left without one`);
          projectRows.push({
            id,
            projectName: String(p.projectName),
            projectDescription: str(p.projectDescription, ""),
            workspaceId: workspaceId && workspaceIds.has(workspaceId) ? workspaceId : null,
            projectManagerId: managerId,
            startDate: date(p.startDate, created),
            projectStatus: p.projectStatus === "Completed" ? "Completed" : "In Progress",
            createdAt: created,
            updatedAt: date(p.updatedAt, created),
          });
          // The manager is always a member row (older data sometimes forgot to list them).
          const members = [managerId, ...(p.projectMembers || []).map(user).filter(Boolean)];
          [...new Set(members)].forEach((userId, i) =>
            projectMemberRows.push({ projectId: id, userId, addedAt: new Date(created.getTime() + i) })
          );
          commentsFor(p.projectComments, { projectId: id });
          mediaFor(p.attachedMediaURLSet, { projectId: id });
        }
        await insert("projects", "project", projectRows);
        await insert("project_members", "projectMember", projectMemberRows);

        // ---- tasks and sub-tasks
        const taskRows = [];
        const subtaskRows = [];
        table("tasks").read = docs.tasks.length;
        const taskIds = new Set();
        for (const t of docs.tasks) {
          const id = idOf(t._id);
          const projectId = idOf(t.project);
          const assignedToId = user(t.assignedTo);
          if (!id || !projectId || !projectIds.has(projectId) || !assignedToId || !t.taskTitle) {
            table("tasks").dropped++;
            warn(`task ${t._id}: missing id, title, existing project or assignee, skipped`);
            continue;
          }
          taskIds.add(id);
          const created = date(t.createdAt, new Date());
          taskRows.push({
            id,
            taskTitle: String(t.taskTitle),
            taskDescription: str(t.taskDescription, ""),
            taskPriority: ["High", "Medium", "Low"].includes(t.taskPriority) ? t.taskPriority : "Medium",
            projectId,
            assignedById: user(t.assignedBy),
            assignedToId,
            taskStatus: str(t.taskStatus, "To Do"),
            completedAt: date(t.completedAt),
            dueDate: str(t.dueDate),
            assignedOn: str(t.assignedOn),
            labels: Array.isArray(t.labels) ? t.labels.map(String) : [],
            estimateHours: num(t.estimateHours),
            createdAt: created,
            updatedAt: date(t.updatedAt, created),
          });
          for (const s of t.subtasks || []) {
            const sid = idOf(s._id);
            if (!sid || !s.title) continue;
            subtaskRows.push({ id: sid, taskId: id, title: String(s.title), done: Boolean(s.done), completedAt: date(s.completedAt), createdAt: date(s.createdAt, created) });
          }
          commentsFor(t.taskComments, { taskId: id });
          mediaFor(t.attachedMediaURLSet, { taskId: id });
        }
        await insert("tasks", "task", taskRows);
        await insert("subtasks", "subtask", subtaskRows);

        // Comments and media were collected while walking projects and tasks; drop any whose parent was skipped.
        const keep = (row) => (row.projectId ? projectIds.has(row.projectId) : taskIds.has(row.taskId));
        table("comments").read = docs.comments.length;
        table("comments").dropped = docs.comments.length - commentRows.filter(keep).length;
        await insert("comments", "comment", commentRows.filter(keep));
        table("media").read = mediaRows.length;
        await insert("media", "media", mediaRows.filter(keep));

        // ---- activity feed
        const activityRows = [];
        table("activities").read = docs.activities.length;
        for (const a of docs.activities) {
          const id = idOf(a._id);
          const projectId = idOf(a.project);
          if (!id || !projectId || !projectIds.has(projectId) || !a.verb || !CATEGORIES.has(a.category)) {
            table("activities").dropped++;
            continue;
          }
          activityRows.push({
            id, projectId, actorId: user(a.actor), actorName: str(a.actorName, "Someone"), verb: String(a.verb), category: a.category,
            taskId: idOf(a.task), data: json(a.data), createdAt: date(a.createdAt, new Date()),
          });
        }
        await insert("activities", "activity", activityRows);

        // ---- notifications
        const notificationRows = [];
        table("notifications").read = docs.notifications.length;
        for (const n of docs.notifications) {
          const id = idOf(n._id);
          const userId = user(n.user);
          if (!id || !userId || !n.type) {
            table("notifications").dropped++;
            continue;
          }
          const projectId = idOf(n.project);
          notificationRows.push({
            id, userId, type: String(n.type), actorName: str(n.actorName, "Someone"),
            projectId: projectId && projectIds.has(projectId) ? projectId : null,
            projectName: str(n.projectName), taskId: idOf(n.task), data: json(n.data),
            readAt: date(n.readAt), createdAt: date(n.createdAt, new Date()),
          });
        }
        await insert("notifications", "notification", notificationRows);

        // ---- invitations
        const inviteRows = [];
        const usedHashes = new Set();
        table("invites").read = docs.invites.length;
        for (const i of docs.invites) {
          const id = idOf(i._id);
          const workspaceId = idOf(i.workspace);
          const email = str(i.email, "").trim().toLowerCase();
          if (!id || !workspaceId || !workspaceIds.has(workspaceId) || !email || !i.tokenHash || usedHashes.has(i.tokenHash)) {
            table("invites").dropped++;
            continue;
          }
          usedHashes.add(i.tokenHash);
          inviteRows.push({
            id, workspaceId, email, role: i.role === "admin" ? "admin" : "member", tokenHash: String(i.tokenHash),
            invitedById: user(i.invitedBy), createdAt: date(i.createdAt, new Date()), expiresAt: date(i.expiresAt, new Date()),
            acceptedAt: date(i.acceptedAt), acceptedById: user(i.acceptedBy), revokedAt: date(i.revokedAt),
          });
        }
        await insert("invites", "invite", inviteRows);

        report.sourceCounts = Object.fromEntries(TABLES.map((n) => [n, docs[n].length]));
        if (dryRun) throw new DryRun();
      },
      { timeout: 15 * 60 * 1000, maxWait: 30 * 1000 }
    );
  } catch (err) {
    if (!(err instanceof DryRun)) throw err;
    report.dryRun = true;
  }

  for (const [name, t] of Object.entries(report)) {
    if (t && typeof t === "object" && "read" in t) log(`${name.padEnd(18)} read ${t.read}  inserted ${t.inserted}  dropped ${t.dropped}`);
  }
  return report;
}

// ------------------------------------------------------------------ CLI

async function main() {
  const dryRun = process.argv.includes("--dry-run");
  require("dotenv").config();
  const { prisma, disconnectFromDatabase } = require("../db/prisma");
  const source = await mongoSource(legacyMongoUri());
  try {
    console.log(dryRun ? "Dry run: nothing will be written." : "Importing from MongoDB into PostgreSQL...");
    const report = await migrate(source, prisma, { dryRun, log: console.log });
    for (const w of report.warnings) console.warn(`warning: ${w}`);
    console.log(dryRun ? "Dry run finished (rolled back)." : "Done. Safe to run again: existing rows are skipped.");
  } finally {
    await source.close();
    await disconnectFromDatabase();
  }
}

if (require.main === module) {
  main().catch((err) => {
    console.error("Migration failed:", err.message);
    process.exit(1);
  });
}

module.exports = { migrate, fixtureSource, mongoSource, legacyMongoUri };

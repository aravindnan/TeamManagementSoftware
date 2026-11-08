// Exercises scripts/migrate-mongo-to-postgres.js against fixture documents shaped like the old MongoDB data
// (ObjectId instances, embedded sub-documents, back-reference arrays, a few dangling references).
const request = require("supertest");
const bcrypt = require("bcryptjs");
const { ObjectId } = require("mongodb");
const { prisma, assertTestDatabase, resetDatabase } = require("./helpers/db");
const { migrate, fixtureSource, legacyMongoUri } = require("../scripts/migrate-mongo-to-postgres");

const oid = () => new ObjectId();
const at = (s) => new Date(s);

let app;
beforeAll(async () => {
  assertTestDatabase();
  const { connectToDatabase } = require("../config/database");
  await connectToDatabase();
  app = require("../app").createApp();
});
afterAll(async () => prisma.$disconnect());
beforeEach(resetDatabase);

function fixture() {
  const ids = Object.fromEntries(
    ["ann", "bob", "cat", "ghost", "ws", "proj", "legacyProj", "orphanProj", "t1", "t2", "t3", "sub1", "c1", "c2", "c3", "m1", "m2", "act1", "act2", "act3", "n1", "n2", "inv1", "inv2"]
      .map((k) => [k, oid()])
  );
  const password = bcrypt.hashSync("Passw0rd!x", 4);
  const user = (key, extra = {}) => ({
    _id: ids[key], username: key, email: `${key}@Example.com`, password, firstName: key.toUpperCase(), lastName: "Doe", role: "Dev",
    emailVerified: key === "ann", tokenVersion: 3, allTasks: [], myProjects: [], involvedProjects: [],
    createdAt: at("2024-01-01"), updatedAt: at("2024-01-02"), __v: 0, ...extra,
  });
  return {
    ids,
    data: {
      users: [
        user("ann", { googleId: "g-ann", allTasks: [ids.t1] }),
        user("bob"),
        user("cat"),
        { ...user("bob"), _id: oid(), username: "bob2" }, // same email as bob: must be skipped, not crash
      ],
      workspaces: [
        { _id: ids.ws, name: "Acme", owner: ids.ann, createdAt: at("2024-02-01"), members: [
          { user: ids.ann, role: "owner", joinedAt: at("2024-02-01") },
          { user: ids.bob, role: "admin", joinedAt: at("2024-02-02") },
          { user: ids.ghost, role: "member", joinedAt: at("2024-02-03") }, // deleted account
        ] },
      ],
      projects: [
        {
          _id: ids.proj, projectName: "Apollo", projectDescription: "d", workspace: ids.ws, projectManager: ids.ann,
          projectMembers: [ids.ann, ids.bob, ids.ghost], allTasks: [ids.t1, ids.t2], startDate: at("2024-03-01"), projectStatus: "In Progress",
          attachedMediaURLSet: [{ _id: ids.m1, mediaURL: "https://x.test/a.png", mediaName: "a.png", mediaSize: 12, uploadedBy: ids.bob }],
          projectComments: [ids.c1, oid()], // the second id points at nothing
          createdAt: at("2024-03-01"), updatedAt: at("2024-03-05"),
        },
        // pre-workspace project whose manager forgot to list themselves as a member
        { _id: ids.legacyProj, projectName: "Legacy", projectManager: ids.cat, projectMembers: [ids.bob], createdAt: at("2023-01-01") },
        { _id: ids.orphanProj, projectName: "Orphan", projectManager: ids.ghost, projectMembers: [], createdAt: at("2023-01-01") },
      ],
      tasks: [
        {
          _id: ids.t1, taskTitle: "One", project: ids.proj, assignedBy: ids.ann, assignedTo: ids.bob, taskStatus: "Completed",
          completedAt: at("2024-03-04"), dueDate: "2024-03-10", assignedOn: "2024-03-02T00:00:00.000Z", labels: ["bug"], estimateHours: 3,
          subtasks: [{ _id: ids.sub1, title: "step", done: true, completedAt: at("2024-03-03"), createdAt: at("2024-03-02") }],
          attachedMediaURLSet: [{ _id: ids.m2, mediaURL: "https://x.test/b.pdf", uploadedBy: ids.ghost }],
          taskComments: [ids.c2], createdAt: at("2024-03-02"), updatedAt: at("2024-03-04"),
        },
        { _id: ids.t2, taskTitle: "Two", project: ids.proj, assignedBy: ids.ghost, assignedTo: ids.ann, taskStatus: "In Progress", taskComments: [], createdAt: at("2024-03-03") },
        { _id: ids.t3, taskTitle: "Dangling", project: ids.orphanProj, assignedBy: ids.cat, assignedTo: ids.cat, createdAt: at("2024-03-03") },
      ],
      comments: [
        { _id: ids.c1, senderName: "ANN Doe", messageContent: "hello", senderId: ids.ann, timeStamp: at("2024-03-02") },
        { _id: ids.c2, senderName: "Gone Person", messageContent: "bye", senderId: ids.ghost, timeStamp: at("2024-03-03") },
        { _id: ids.c3, senderName: "Nobody", messageContent: "unreferenced", senderId: ids.ann },
      ],
      activities: [
        { _id: ids.act1, project: ids.proj, actor: ids.ann, actorName: "ANN Doe", verb: "task.status_changed", category: "task", task: ids.t1, data: { from: "To Do", to: "Completed" }, createdAt: at("2024-03-04") },
        { _id: ids.act2, project: ids.proj, actor: ids.ghost, verb: "task.deleted", category: "task", task: oid(), data: { title: "gone" }, createdAt: at("2024-03-05") },
        { _id: ids.act3, project: ids.orphanProj, actor: ids.ann, verb: "project.created", category: "project", data: {} },
      ],
      notifications: [
        { _id: ids.n1, user: ids.bob, type: "task.created", actorName: "ANN Doe", project: ids.proj, projectName: "Apollo", task: ids.t1, data: { title: "One" }, createdAt: at("2024-03-02") },
        { _id: ids.n2, user: ids.ghost, type: "task.created", createdAt: at("2024-03-02") },
      ],
      invites: [
        { _id: ids.inv1, workspace: ids.ws, email: "Dan@Example.com", role: "member", tokenHash: "h".repeat(64), invitedBy: ids.ann, createdAt: at("2024-04-01"), expiresAt: at("2099-01-01") },
        { _id: ids.inv2, workspace: oid(), email: "x@example.com", tokenHash: "i".repeat(64), invitedBy: ids.ann, expiresAt: at("2099-01-01") },
      ],
    },
  };
}

describe("mongo -> postgres migration", () => {
  test("imports the data, preserves ids, rebuilds relations and drops dangling references", async () => {
    const { ids, data } = fixture();
    const report = await migrate(fixtureSource(data), prisma);

    expect(report.users).toMatchObject({ read: 4, inserted: 3, dropped: 1 });
    expect(await prisma.user.count()).toBe(3);
    const ann = await prisma.user.findUnique({ where: { id: String(ids.ann) } });
    expect(ann).toMatchObject({ email: "ann@example.com", googleId: "g-ann", emailVerified: true, tokenVersion: 3 }); // id and email normalisation kept

    // workspace: owner row guaranteed, deleted member dropped, roles kept
    const members = await prisma.workspaceMember.findMany({ where: { workspaceId: String(ids.ws) }, orderBy: { joinedAt: "asc" } });
    expect(members.map((m) => [m.userId, m.role])).toEqual([[String(ids.ann), "owner"], [String(ids.bob), "admin"]]);

    // projects: the manager is always a member; unknown member dropped; project without manager skipped
    expect(await prisma.project.count()).toBe(2);
    const pm = (id) => prisma.projectMember.findMany({ where: { projectId: String(id) }, orderBy: { addedAt: "asc" } }).then((r) => r.map((x) => x.userId));
    expect(await pm(ids.proj)).toEqual([String(ids.ann), String(ids.bob)]);
    expect(await pm(ids.legacyProj)).toEqual([String(ids.cat), String(ids.bob)]);
    expect((await prisma.project.findUnique({ where: { id: String(ids.legacyProj) } })).workspaceId).toBeNull();

    // tasks: dangling project skipped, missing creator nulled, sub-tasks and files kept with ids
    expect(await prisma.task.count()).toBe(2);
    expect((await prisma.task.findUnique({ where: { id: String(ids.t2) } })).assignedById).toBeNull();
    expect(await prisma.subtask.findUnique({ where: { id: String(ids.sub1) } })).toMatchObject({ taskId: String(ids.t1), done: true });
    expect(await prisma.media.count()).toBe(2);
    expect((await prisma.media.findUnique({ where: { id: String(ids.m2) } })).uploadedBy).toBeNull();

    // comments: kept where something references them, author link nulled when the account is gone
    expect(await prisma.comment.count()).toBe(2);
    expect((await prisma.comment.findUnique({ where: { id: String(ids.c2) } }))).toMatchObject({ taskId: String(ids.t1), senderId: null, senderName: "Gone Person" });

    expect(await prisma.activity.count()).toBe(2);
    expect((await prisma.activity.findUnique({ where: { id: String(ids.act1) } })).data).toEqual({ from: "To Do", to: "Completed" });
    expect(await prisma.notification.count()).toBe(1);
    expect(await prisma.invite.count()).toBe(1);
    expect(await prisma.invite.findUnique({ where: { id: String(ids.inv1) } })).toMatchObject({ email: "dan@example.com", tokenHash: "h".repeat(64) });
    expect(report.warnings.length).toBeGreaterThan(0);
  });

  test("the API works on migrated data: old passwords log in, relations show up where the frontend expects them", async () => {
    const { ids, data } = fixture();
    await migrate(fixtureSource(data), prisma);

    const bob = request.agent(app);
    const login = await bob.post("/login").send({ username: "bob", password: "Passw0rd!x" }).expect(200);
    expect(login.body.userId).toBe(String(ids.bob));
    const me = (await bob.get("/me").expect(200)).body;
    expect(me.involvedProjects.map((p) => p._id).sort()).toEqual([String(ids.proj), String(ids.legacyProj)].sort());
    expect(me.allTasks.map((t) => t._id)).toEqual([String(ids.t1)]);

    const project = (await bob.get(`/get-project-by-id/${ids.proj}`).expect(200)).body;
    expect(project.workspace).toEqual({ _id: String(ids.ws), name: "Acme" });
    expect(project.projectMembers.map((m) => m._id)).toEqual([String(ids.ann), String(ids.bob)]);
    expect(project.allTasks.map((t) => t.taskTitle)).toEqual(["One", "Two"]);
    expect(project.projectComments.map((c) => c.messageContent)).toEqual(["hello"]);
    const feed = (await bob.get(`/get-project-activity-by-id/${ids.proj}`).expect(200)).body.items;
    expect(feed.map((i) => i._id)).toEqual([String(ids.act2), String(ids.act1)]); // newest id first
    expect((await bob.get(`/workspaces/${ids.ws}`).expect(200)).body.myRole).toBe("admin");
    expect((await bob.get("/notifications").expect(200)).body.items).toHaveLength(1);
  });

  test("is idempotent: a second run inserts nothing and keeps changes made in Postgres", async () => {
    const { ids, data } = fixture();
    await migrate(fixtureSource(data), prisma);
    await prisma.project.update({ where: { id: String(ids.proj) }, data: { projectName: "Renamed in Postgres" } });

    const again = await migrate(fixtureSource(data), prisma);
    for (const t of ["users", "workspaces", "projects", "tasks", "comments", "media", "subtasks", "activities", "notifications", "invites", "workspace_members", "project_members"]) {
      expect(again[t].inserted).toBe(0);
    }
    expect((await prisma.project.findUnique({ where: { id: String(ids.proj) } })).projectName).toBe("Renamed in Postgres");
    expect(await prisma.user.count()).toBe(3);
  });

  test("a dry run reports but writes nothing", async () => {
    const { data } = fixture();
    const report = await migrate(fixtureSource(data), prisma, { dryRun: true });
    expect(report.dryRun).toBe(true);
    expect(report.users.inserted).toBe(3);
    expect(await prisma.user.count()).toBe(0);
    expect(await prisma.task.count()).toBe(0);
  });

  test("empty source is fine", async () => {
    const report = await migrate(fixtureSource({}), prisma);
    expect(report.users.inserted).toBe(0);
  });

  test("builds the Mongo URI from MONGO_URI or the legacy variables", () => {
    expect(legacyMongoUri({ MONGO_URI: "mongodb://x/y" })).toBe("mongodb://x/y");
    expect(legacyMongoUri({ DB_USERNAME: "u s", DB_PASSWORD: "p@ss", DB_NAME: "n", DB_HOST: "h.example.net" })).toBe(
      "mongodb+srv://u%20s:p%40ss@h.example.net/n?retryWrites=true&w=majority"
    );
    expect(() => legacyMongoUri({})).toThrow(/MONGO_URI/);
  });
});

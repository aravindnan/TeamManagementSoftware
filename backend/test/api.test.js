const request = require("supertest");
const mongoose = require("mongoose");
const { MongoMemoryServer } = require("mongodb-memory-server");

process.env.CLOUDINARY_CLOUDNAME = "demo-cloud";
process.env.CLOUDINARY_APIKEY = "123456";
process.env.CLOUDINARY_API_SECRET = "shhh-test-secret";

let mongod, app;
const agent = () => request.agent(app);

const user = (n) => ({
  username: `user${n}`, email: `user${n}@example.com`, password: "Passw0rd!x",
  firstName: `First${n}`, lastName: `Last${n}`, role: "Dev", dateOfBirth: "1990-01-01",
});

async function signup(n) {
  const a = agent();
  await a.post("/register").send(user(n)).expect(201);
  const res = await a.post("/login").send({ username: `user${n}`, password: "Passw0rd!x" }).expect(200);
  return { a, id: res.body.userId };
}

beforeAll(async () => {
  mongod = await MongoMemoryServer.create();
  process.env.MONGO_URI = mongod.getUri();
  const { connectToDatabase } = require("../config/database");
  await connectToDatabase(process.env.MONGO_URI);
  app = require("../app").createApp();
});
afterAll(async () => { await mongoose.disconnect(); await mongod.stop(); });
beforeEach(async () => { await mongoose.connection.db.dropDatabase(); await Promise.all(Object.values(mongoose.models).map((m) => m.syncIndexes())); });

describe("auth", () => {
  test("everything except register/login/logout requires auth", async () => {
    for (const [m, p] of [["get", "/get-all-users"], ["get", "/get-all-projects"], ["delete", "/delete-all-users"], ["get", "/me"]]) {
      const r = await request(app)[m](p);
      expect([401, 404]).toContain(r.status);
      expect(r.status).not.toBe(200);
    }
    await request(app).get("/get-all-users").expect(401);
  });

  test("register validates input and rejects duplicates", async () => {
    await request(app).post("/register").send({ ...user(1), password: "short" }).expect(400);
    await request(app).post("/register").send({ ...user(1), email: "nope" }).expect(400);
    await request(app).post("/register").send(user(1)).expect(201);
    const dup = await request(app).post("/register").send({ ...user(2), username: "user1" }).expect(409);
    expect(dup.body.error).toMatch(/username/i);
  });

  test("login sets an httpOnly cookie, never returns the token or hash, generic failure", async () => {
    await request(app).post("/register").send(user(1));
    const ok = await request(app).post("/login").send({ username: "user1", password: "Passw0rd!x" }).expect(200);
    expect(ok.body.token).toBeUndefined();
    expect(ok.headers["set-cookie"][0]).toMatch(/tms_token=.*HttpOnly/i);
    const bad1 = await request(app).post("/login").send({ username: "user1", password: "wrong" }).expect(401);
    const bad2 = await request(app).post("/login").send({ username: "ghost", password: "wrong" }).expect(401);
    expect(bad1.body.error).toBe(bad2.body.error);
  });

  test("/me returns the profile without secrets; logout revokes the session", async () => {
    const { a } = await signup(1);
    const me = await a.get("/me").expect(200);
    expect(me.body.username).toBe("user1");
    expect(me.body.password).toBeUndefined();
    expect(me.body.tokenVersion).toBeUndefined();
    await a.post("/logout").expect(200);
    await a.get("/me").expect(401);
  });

  test("a token issued before logout stops working (server-side revocation)", async () => {
    await request(app).post("/register").send(user(1));
    const login = await request(app).post("/login").send({ username: "user1", password: "Passw0rd!x" });
    const cookie = login.headers["set-cookie"][0].split(";")[0];
    await request(app).get("/me").set("Cookie", cookie).expect(200);
    await request(app).post("/logout").set("Cookie", cookie).expect(200);
    await request(app).get("/me").set("Cookie", cookie).expect(401);
  });
});

describe("users", () => {
  test("directory exposes only public fields", async () => {
    const { a } = await signup(1); await signup(2);
    const res = await a.get("/get-all-users").expect(200);
    expect(res.body.length).toBe(2);
    for (const u of res.body) {
      expect(u.password).toBeUndefined();
      expect(u.dateOfBirth).toBeUndefined();
    }
  });
  test("cannot read another user's full profile, nor edit or create projects for them", async () => {
    const { a } = await signup(1); const { id: other } = await signup(2);
    const res = await a.get(`/get-user-by-id/${other}`).expect(200);
    expect(res.body.allTasks).toBeUndefined();
    await a.put(`/update-user-profile/${other}`).send({ firstName: "x", email: "x@x.com", username: "xxx" }).expect(403);
    await a.post(`/create-new-project-for-user-id/${other}`).send({ projectName: "p" }).expect(403);
  });
  test("profile update maps duplicate username to 409", async () => {
    const { a, id } = await signup(1); await signup(2);
    await a.put(`/update-user-profile/${id}`).send({ firstName: "A", email: "user1@example.com", username: "user2" }).expect(409);
  });
});

describe("projects & tasks", () => {
  async function setup() {
    const m = await signup(1), t = await signup(2), outsider = await signup(3);
    const p = await m.a.post(`/create-new-project-for-user-id/${m.id}`).send({ projectName: "Proj", projectDescription: "d" }).expect(201);
    const projectId = p.body.project._id;
    await m.a.post(`/add-new-member-by-project-id/${projectId}`).send({ memberId: t.id }).expect(200);
    return { m, t, outsider, projectId };
  }
  const taskBody = (assignedTo) => ({ taskTitle: "Do it", taskDescription: "x", taskPriority: "High", dueDate: "2030-01-01", assignedTo });

  test("non-members cannot read or touch a project", async () => {
    const { outsider, projectId } = await setup();
    await outsider.a.get(`/get-project-by-id/${projectId}`).expect(403);
    await outsider.a.post(`/add-comment-to-project-by-id/${projectId}`).send({ messageContent: "hi" }).expect(403);
    await outsider.a.delete(`/delete-project-by-id/${projectId}`).expect(403);
    const list = await outsider.a.get("/get-all-projects").expect(200);
    expect(list.body).toEqual([]);
  });

  test("only the manager can edit/delete/add members/add tasks", async () => {
    const { t, projectId } = await setup();
    await t.a.put(`/edit-project-by-id/${projectId}`).send({ projectName: "x", projectStatus: "Completed" }).expect(403);
    await t.a.delete(`/delete-project-by-id/${projectId}`).expect(403);
    await t.a.post(`/add-new-task-by-project-id/${projectId}`).send(taskBody(t.id)).expect(403);
    await t.a.post(`/add-new-member-by-project-id/${projectId}`).send({ memberId: t.id }).expect(403);
  });

  test("task creation validates assignee, sets assignedBy from the session, no double response", async () => {
    const { m, t, outsider, projectId } = await setup();
    await m.a.post(`/add-new-task-by-project-id/${projectId}`).send(taskBody(outsider.id)).expect(400);
    await m.a.post(`/add-new-task-by-project-id/${projectId}`).send({ ...taskBody(t.id), assignedBy: outsider.id }).expect(201);
    const proj = await m.a.get(`/get-project-by-id/${projectId}`).expect(200);
    expect(proj.body.allTasks).toHaveLength(1);
    expect(proj.body.allTasks[0].assignedBy).toBe(m.id);
    expect(proj.body.projectManager.password).toBeUndefined();
    const mine = await t.a.get("/me").expect(200);
    expect(mine.body.allTasks).toHaveLength(1);
  });

  test("tasks start in To Do and can move through every board column", async () => {
    const { m, t, outsider, projectId } = await setup();
    const c = await m.a.post(`/add-new-task-by-project-id/${projectId}`).send(taskBody(t.id));
    const id = c.body.taskId;
    expect((await t.a.get(`/get-task-by-id/${id}`)).body.taskStatus).toBe("To Do");
    for (const status of ["In Progress", "In Review", "Completed", "To Do"]) {
      await t.a.put(`/change-task-status-by-id/${id}`).send({ newStatus: status }).expect(200);
      expect((await t.a.get(`/get-task-by-id/${id}`)).body.taskStatus).toBe(status);
    }
    await outsider.a.put(`/change-task-status-by-id/${id}`).send({ newStatus: "Completed" }).expect(403);
    // a plain member who is neither assignee, creator nor manager cannot move it
    const bystander = await signup(5);
    await m.a.post(`/add-new-member-by-project-id/${projectId}`).send({ memberId: bystander.id });
    await bystander.a.put(`/change-task-status-by-id/${id}`).send({ newStatus: "Completed" }).expect(403);
  });

  test("risk radar: members only, explains each task, and completedAt tracks completion", async () => {
    const { m, t, outsider, projectId } = await setup();
    const overdue = await m.a.post(`/add-new-task-by-project-id/${projectId}`).send({ ...taskBody(t.id), dueDate: "2020-01-01" });
    await m.a.post(`/add-new-task-by-project-id/${projectId}`).send({ ...taskBody(t.id), taskTitle: "Far away", dueDate: "2099-01-01" });
    await outsider.a.get(`/get-project-risk-by-id/${projectId}`).expect(403);
    const res = await t.a.get(`/get-project-risk-by-id/${projectId}`).expect(200);
    expect(res.body.summary).toMatchObject({ openTasks: 2, high: 1, onTrack: 1 });
    expect(res.body.tasks[0].taskId).toBe(overdue.body.taskId);
    expect(res.body.tasks[0].reasons[0]).toMatch(/^Overdue by/);

    const Task = mongoose.model("Task");
    expect((await Task.findById(overdue.body.taskId)).completedAt).toBeUndefined();
    await t.a.put(`/change-task-status-by-id/${overdue.body.taskId}`).send({ newStatus: "Completed" }).expect(200);
    expect((await Task.findById(overdue.body.taskId)).completedAt).toBeInstanceOf(Date);
    await t.a.put(`/change-task-status-by-id/${overdue.body.taskId}`).send({ newStatus: "In Progress" }).expect(200);
    expect((await Task.findById(overdue.body.taskId)).completedAt).toBeUndefined();
    const after = await t.a.get(`/get-project-risk-by-id/${projectId}`).expect(200);
    expect(after.body.summary.openTasks).toBe(2);
  });

  test("performance endpoint works", async () => {
    const { m, t, projectId } = await setup();
    const c = await m.a.post(`/add-new-task-by-project-id/${projectId}`).send(taskBody(t.id));
    await m.a.post(`/add-new-task-by-project-id/${projectId}`).send(taskBody(t.id));
    await t.a.put(`/change-task-status-by-id/${c.body.taskId}`).send({ newStatus: "Completed" }).expect(200);
    const perf = await m.a.get(`/get-project-overall-performance-by-id/${projectId}`).expect(200);
    expect(perf.body.overallPerformance).toBe(50);
    const members = await m.a.get(`/get-project-members-by-id/${projectId}`).expect(200);
    expect(members.body).toHaveLength(2);
    const tasks = await m.a.get(`/get-all-tasks-by-project-id/${projectId}`).expect(200);
    expect(tasks.body).toHaveLength(2);
  });

  test("status/edit rules and input validation", async () => {
    const { m, t, outsider, projectId } = await setup();
    const c = await m.a.post(`/add-new-task-by-project-id/${projectId}`).send(taskBody(t.id));
    const id = c.body.taskId;
    await outsider.a.get(`/get-task-by-id/${id}`).expect(403);
    await t.a.put(`/change-task-status-by-id/${id}`).send({ newStatus: "Banana" }).expect(400);
    await t.a.get(`/get-task-by-id/${id}`).expect(200);
    await t.a.delete(`/delete-task-by-id/${id}`).expect(403); // assignee isn't creator/manager
    await m.a.delete(`/delete-task-by-id/${id}`).expect(200);
    await m.a.get(`/get-task-by-id/${id}`).expect(404);
  });

  test("comments use the session identity, trim, and reject empty", async () => {
    const { t, projectId } = await setup();
    await t.a.post(`/add-comment-to-project-by-id/${projectId}`).send({ messageContent: "   " }).expect(400);
    await t.a.post(`/add-comment-to-project-by-id/${projectId}`).send({ messageContent: " hi ", senderName: "Admin", senderId: "x" }).expect(200);
    const p = await t.a.get(`/get-project-by-id/${projectId}`);
    expect(p.body.projectComments[0].senderName).toBe("First2 Last2");
    expect(p.body.projectComments[0].messageContent).toBe("hi");
  });

  test("removing a member reassigns their tasks to the manager; manager cannot be removed", async () => {
    const { m, t, projectId } = await setup();
    const c = await m.a.post(`/add-new-task-by-project-id/${projectId}`).send(taskBody(t.id));
    await m.a.delete(`/remove-member-from-project-by-id/${projectId}`).send({ memberId: m.id }).expect(400);
    await m.a.delete(`/remove-member-from-project-by-id/${projectId}`).send({ memberId: t.id }).expect(200);
    const task = await m.a.get(`/get-task-by-id/${c.body.taskId}`).expect(200);
    expect(task.body.assignedTo._id).toBe(m.id);
    const tm = await t.a.get("/me").expect(200);
    expect(tm.body.allTasks).toHaveLength(0);
    expect(tm.body.involvedProjects).toHaveLength(0);
  });

  test("media: https only, uploader/manager can remove", async () => {
    const { m, t, projectId } = await setup();
    await t.a.post(`/add-media-to-project/${projectId}`).send({ mediaDataArray: [{ mediaURL: "http://x/y.png" }] }).expect(400);
    await t.a.post(`/add-media-to-project/${projectId}`).send({ mediaDataArray: [{ mediaURL: "https://x.test/y.png", mediaName: "y" }] }).expect(200);
    const t2 = await signup(4);
    await m.a.post(`/add-new-member-by-project-id/${projectId}`).send({ memberId: t2.id });
    await t2.a.delete(`/remove-media-from-project/${projectId}`).send({ mediaURL: "https://x.test/y.png" }).expect(403);
    await m.a.delete(`/remove-media-from-project/${projectId}`).send({ mediaURL: "https://x.test/y.png" }).expect(200);
  });

  test("deleting a project cascades tasks, comments and user references", async () => {
    const { m, t, projectId } = await setup();
    await m.a.post(`/add-new-task-by-project-id/${projectId}`).send(taskBody(t.id));
    await m.a.post(`/add-comment-to-project-by-id/${projectId}`).send({ messageContent: "bye" });
    await m.a.delete(`/delete-project-by-id/${projectId}`).expect(200);
    expect(await mongoose.model("Task").countDocuments()).toBe(0);
    expect(await mongoose.model("Comment").countDocuments()).toBe(0);
    const tm = await t.a.get("/me");
    expect(tm.body.allTasks).toHaveLength(0);
    expect(tm.body.involvedProjects).toHaveLength(0);
  });

  test("malformed ids return 400, unknown routes 404, removed destructive routes are gone", async () => {
    const { m } = await setup();
    await m.a.get("/get-project-by-id/not-an-id").expect(400);
    await m.a.delete("/delete-all-projects").expect(404);
    await m.a.delete("/delete-all-tasks").expect(404);
    await m.a.delete("/delete-all-data").expect(404);
  });
});

describe("analytics", () => {
  async function scene() {
    const m = await signup(1), t = await signup(2), outsider = await signup(3);
    const projectId = (await m.a.post(`/create-new-project-for-user-id/${m.id}`).send({ projectName: "Proj" })).body.project._id;
    await m.a.post(`/add-new-member-by-project-id/${projectId}`).send({ memberId: t.id });
    const mk = (title, who) => m.a.post(`/add-new-task-by-project-id/${projectId}`).send({ taskTitle: title, dueDate: "2020-01-01", assignedTo: who });
    const a = await mk("A", t.id), b = await mk("B", t.id), c = await mk("C", m.id);
    return { m, t, outsider, projectId, a: a.body.taskId, b: b.body.taskId, c: c.body.taskId };
  }

  test("members only", async () => {
    const { outsider, projectId } = await scene();
    await outsider.a.get(`/get-project-analytics-by-id/${projectId}`).expect(403);
  });

  test("reports flow metrics that follow task movement", async () => {
    const { m, t, projectId, a, b } = await scene();
    await t.a.put(`/change-task-status-by-id/${a}`).send({ newStatus: "In Progress" }).expect(200);
    await t.a.put(`/change-task-status-by-id/${b}`).send({ newStatus: "Completed" }).expect(200);
    const r = (await m.a.get(`/get-project-analytics-by-id/${projectId}`).expect(200)).body;
    expect(r.summary).toMatchObject({ total: 3, open: 2, completed: 1, overdue: 2, completionRate: 33 });
    expect(r.cycleTime.sampleSize).toBe(1);
    expect(r.throughput).toHaveLength(8);
    expect(r.throughput[7].completed).toBe(1); // completed just now -> current week
    expect(r.burnup).toHaveLength(30);
    expect(r.burnup[29]).toMatchObject({ created: 3, completed: 1 });
    expect(r.aging.map((x) => x.taskId)).toEqual([a]);
    expect(r.aging[0].daysInColumn).toBeLessThan(1); // moved moments ago, per the activity log
  });

  test("the manager sees everyone; a member only sees their own row", async () => {
    const { m, t, projectId } = await scene();
    const asManager = (await m.a.get(`/get-project-analytics-by-id/${projectId}`)).body;
    expect(asManager.scope).toBe("all");
    expect(asManager.byAssignee.map((p) => p.assignedTo).sort()).toEqual([m.id, t.id].sort());
    const asMember = (await t.a.get(`/get-project-analytics-by-id/${projectId}`)).body;
    expect(asMember.scope).toBe("self");
    expect(asMember.byAssignee).toHaveLength(1);
    expect(asMember.byAssignee[0]).toMatchObject({ assignedTo: t.id, open: 2 });
    // project-level figures are the same for both
    expect(asMember.summary).toEqual(asManager.summary);
  });
});

describe("activity feed", () => {
  async function scene() {
    const m = await signup(1), t = await signup(2), outsider = await signup(3);
    const projectId = (await m.a.post(`/create-new-project-for-user-id/${m.id}`).send({ projectName: "Proj" })).body.project._id;
    await m.a.post(`/add-new-member-by-project-id/${projectId}`).send({ memberId: t.id });
    const task = await m.a.post(`/add-new-task-by-project-id/${projectId}`).send({ taskTitle: "Ship it", taskPriority: "Low", dueDate: "2030-01-01", assignedTo: t.id });
    return { m, t, outsider, projectId, taskId: task.body.taskId };
  }
  const feed = async (a, projectId, qs = "") => (await a.get(`/get-project-activity-by-id/${projectId}${qs}`).expect(200)).body;

  test("records the full lifecycle, newest first, with readable snapshots", async () => {
    const { m, t, projectId, taskId } = await scene();
    await t.a.put(`/change-task-status-by-id/${taskId}`).send({ newStatus: "In Review" }).expect(200);
    await t.a.put(`/change-task-status-by-id/${taskId}`).send({ newStatus: "In Review" }).expect(200); // no-op: must not log
    await m.a.put(`/edit-task-by-id/${taskId}`).send({ taskTitle: "Ship it now", taskDescription: "", taskPriority: "High", taskStatus: "In Review", dueDate: "2030-01-01" }).expect(200);
    await t.a.post(`/add-comment-to-task-by-id/${taskId}`).send({ messageContent: "on it" }).expect(200);
    await t.a.post(`/add-comment-to-project-by-id/${projectId}`).send({ messageContent: "hello team" }).expect(200);
    await t.a.post(`/add-media-to-task/${taskId}`).send({ mediaDataArray: [{ mediaURL: "https://x.test/a.png", mediaName: "a.png" }] }).expect(200);
    await m.a.put(`/edit-project-by-id/${projectId}`).send({ projectName: "Proj 2", projectDescription: "", projectStatus: "In Progress" }).expect(200);
    await m.a.delete(`/delete-task-by-id/${taskId}`).expect(200);

    const { items, nextCursor } = await feed(m.a, projectId, "?limit=50");
    expect(nextCursor).toBeNull();
    expect(items.map((i) => i.verb)).toEqual([
      "task.deleted", "project.updated", "media.added", "comment.project", "comment.task",
      "task.updated", "task.status_changed", "task.created", "member.added", "project.created",
    ]);
    const byVerb = Object.fromEntries(items.map((i) => [i.verb, i]));
    expect(byVerb["task.status_changed"].data).toEqual({ title: "Ship it", from: "To Do", to: "In Review" });
    expect(byVerb["task.status_changed"].actorName).toBe("First2 Last2");
    expect(byVerb["task.updated"].data.changes).toEqual([
      { field: "title", from: "Ship it", to: "Ship it now" },
      { field: "priority", from: "Low", to: "High" },
    ]);
    expect(byVerb["task.created"].data).toMatchObject({ title: "Ship it", assigneeName: "First2 Last2" });
    expect(byVerb["member.added"].data.memberName).toBe("First2 Last2");
    expect(byVerb["project.updated"].data.changes).toEqual([{ field: "name", from: "Proj", to: "Proj 2" }]);
    expect(byVerb["comment.task"].data.excerpt).toBe("on it");
    expect(byVerb["media.added"].data.names).toEqual(["a.png"]);
    // the deleted task is still described by its snapshot
    expect(byVerb["task.deleted"].data.title).toBe("Ship it now");
  });

  test("members only", async () => {
    const { outsider, projectId } = await scene();
    await outsider.a.get(`/get-project-activity-by-id/${projectId}`).expect(403);
  });

  test("cursor pagination returns every entry exactly once", async () => {
    const { m, projectId } = await scene();
    for (let i = 0; i < 5; i++) await m.a.post(`/add-comment-to-project-by-id/${projectId}`).send({ messageContent: `c${i}` });
    const all = (await feed(m.a, projectId, "?limit=50")).items.map((i) => i._id);
    const seen = [];
    let cursor = null;
    let pages = 0;
    do {
      const page = await feed(m.a, projectId, `?limit=3${cursor ? `&before=${cursor}` : ""}`);
      seen.push(...page.items.map((i) => i._id));
      cursor = page.nextCursor;
      pages++;
    } while (cursor);
    expect(seen).toEqual(all);
    expect(pages).toBe(Math.ceil(all.length / 3));
  });

  test("filters by category and validates query params", async () => {
    const { m, projectId } = await scene();
    await m.a.post(`/add-comment-to-project-by-id/${projectId}`).send({ messageContent: "hi" });
    const comments = await feed(m.a, projectId, "?category=comment");
    expect(comments.items).toHaveLength(1);
    expect(comments.items[0].verb).toBe("comment.project");
    await m.a.get(`/get-project-activity-by-id/${projectId}?limit=0`).expect(400);
    await m.a.get(`/get-project-activity-by-id/${projectId}?limit=500`).expect(400);
    await m.a.get(`/get-project-activity-by-id/${projectId}?before=nope`).expect(400);
    await m.a.get(`/get-project-activity-by-id/${projectId}?category=weird`).expect(400);
  });

  test("removing a member logs how many tasks were handed over", async () => {
    const { m, t, projectId } = await scene();
    await m.a.delete(`/remove-member-from-project-by-id/${projectId}`).send({ memberId: t.id }).expect(200);
    const { items } = await feed(m.a, projectId);
    expect(items[0]).toMatchObject({ verb: "member.removed", data: { memberName: "First2 Last2", reassigned: 1 } });
  });

  test("a failure to record activity never breaks the action", async () => {
    const { t, projectId, taskId } = await scene();
    const Activity = mongoose.model("Activity");
    const spy = jest.spyOn(Activity, "create").mockRejectedValueOnce(new Error("db hiccup"));
    await t.a.put(`/change-task-status-by-id/${taskId}`).send({ newStatus: "Completed" }).expect(200);
    spy.mockRestore();
    expect((await t.a.get(`/get-task-by-id/${taskId}`)).body.taskStatus).toBe("Completed");
  });

  test("deleting a project deletes its feed", async () => {
    const { m, projectId } = await scene();
    expect(await mongoose.model("Activity").countDocuments({ project: projectId })).toBeGreaterThan(0);
    await m.a.delete(`/delete-project-by-id/${projectId}`).expect(200);
    expect(await mongoose.model("Activity").countDocuments({ project: projectId })).toBe(0);
  });
});

describe("notifications", () => {
  async function scene() {
    const m = await signup(1), t = await signup(2), b = await signup(4);
    const projectId = (await m.a.post(`/create-new-project-for-user-id/${m.id}`).send({ projectName: "Proj" })).body.project._id;
    await m.a.post(`/add-new-member-by-project-id/${projectId}`).send({ memberId: t.id });
    await m.a.post(`/add-new-member-by-project-id/${projectId}`).send({ memberId: b.id });
    const task = await m.a.post(`/add-new-task-by-project-id/${projectId}`).send({ taskTitle: "Ship it", taskPriority: "High", dueDate: "2030-01-01", assignedTo: t.id });
    return { m, t, b, projectId, taskId: task.body.taskId };
  }
  const inbox = async (u, qs = "") => (await u.a.get(`/notifications${qs}`).expect(200)).body;
  const types = async (u) => (await inbox(u)).items.map((n) => n.type);

  test("assigning a task notifies the assignee, never the actor or bystanders", async () => {
    const { m, t, b } = await scene();
    expect(await types(m)).toEqual([]);
    expect(await types(b)).toEqual(["member.added"]); // only for being added
    const mine = (await inbox(t)).items;
    expect(mine.map((n) => n.type)).toEqual(["task.created", "member.added"]);
    expect(mine[0]).toMatchObject({ actorName: "First1 Last1", projectName: "Proj", data: { title: "Ship it" } });
  });

  test("status changes and comments notify the other party on the task, not the person who acted", async () => {
    const { m, t, b, taskId } = await scene();
    await t.a.put(`/change-task-status-by-id/${taskId}`).send({ newStatus: "In Review" }).expect(200);
    expect(await types(m)).toEqual(["task.status_changed"]); // creator is told
    expect((await types(t)).includes("task.status_changed")).toBe(false); // actor is not
    await m.a.post(`/add-comment-to-task-by-id/${taskId}`).send({ messageContent: "looks good" }).expect(200);
    await t.a.post(`/add-comment-to-task-by-id/${taskId}`).send({ messageContent: "thanks" }).expect(200);
    expect((await types(t))[0]).toBe("comment.task");
    expect((await types(m))[0]).toBe("comment.task");
    expect((await types(b)).filter((x) => x !== "member.added")).toEqual([]); // bystander hears nothing
  });

  test("assigning a task to yourself is silent", async () => {
    const { m, projectId } = await scene();
    await m.a.post(`/add-new-task-by-project-id/${projectId}`).send({ taskTitle: "Mine", assignedTo: m.id }).expect(201);
    expect(await types(m)).toEqual([]);
  });

  test("being removed from a project, and a task being deleted, notify the affected person", async () => {
    const { m, t, b, projectId, taskId } = await scene();
    await m.a.delete(`/delete-task-by-id/${taskId}`).expect(200);
    expect((await types(t))[0]).toBe("task.deleted");
    await m.a.delete(`/remove-member-from-project-by-id/${projectId}`).send({ memberId: b.id }).expect(200);
    expect((await types(b))[0]).toBe("member.removed");
  });

  test("unread count, mark read, mark all read and the unread filter", async () => {
    const { t } = await scene();
    expect((await t.a.get("/notifications/unread-count").expect(200)).body.count).toBe(2);
    const { items, unreadCount } = await inbox(t);
    expect(unreadCount).toBe(2);
    await t.a.post(`/notifications/${items[0]._id}/read`).expect(200);
    expect((await t.a.get("/notifications/unread-count")).body.count).toBe(1);
    await t.a.post(`/notifications/${items[0]._id}/read`).expect(200); // idempotent
    const unread = await inbox(t, "?unread=true");
    expect(unread.items.map((n) => n._id)).toEqual([items[1]._id]);
    const all = await t.a.post("/notifications/read-all").expect(200);
    expect(all.body.updated).toBe(1);
    expect((await t.a.get("/notifications/unread-count")).body.count).toBe(0);
    expect((await inbox(t)).items).toHaveLength(2); // read items stay in the inbox
  });

  test("cursor pagination returns every notification once", async () => {
    const { m, t, projectId } = await scene();
    for (let i = 0; i < 4; i++) await m.a.post(`/add-new-task-by-project-id/${projectId}`).send({ taskTitle: `T${i}`, assignedTo: t.id });
    const all = (await inbox(t, "?limit=50")).items.map((n) => n._id);
    const seen = [];
    let cursor = null;
    do {
      const page = await inbox(t, `?limit=4${cursor ? `&before=${cursor}` : ""}`);
      seen.push(...page.items.map((n) => n._id));
      cursor = page.nextCursor;
    } while (cursor);
    expect(seen).toEqual(all);
    expect(all.length).toBe(6);
  });

  test("inboxes are private: no cross-user reads, and auth is required", async () => {
    const { m, t } = await scene();
    const theirs = (await inbox(t)).items[0];
    await m.a.post(`/notifications/${theirs._id}/read`).expect(404);
    expect((await t.a.get("/notifications/unread-count")).body.count).toBe(2); // untouched
    await request(app).get("/notifications").expect(401);
    await request(app).get("/notifications/unread-count").expect(401);
    await m.a.post("/notifications/not-an-id/read").expect(400);
    await m.a.get("/notifications?limit=0").expect(400);
  });

  test("deleting a project removes its notifications", async () => {
    const { m, t, projectId } = await scene();
    expect((await inbox(t)).items.length).toBeGreaterThan(0);
    await m.a.delete(`/delete-project-by-id/${projectId}`).expect(200);
    expect((await inbox(t)).items).toEqual([]);
  });
});

describe("uploads", () => {
  test("sign endpoint requires auth and returns a valid scoped signature without leaking the secret", async () => {
    await request(app).post("/uploads/sign").expect(401);
    const { a } = await signup(1);
    const res = await a.post("/uploads/sign").expect(200);
    const crypto = require("crypto");
    const expected = crypto.createHash("sha1").update(`folder=tms&timestamp=${res.body.timestamp}shhh-test-secret`).digest("hex");
    expect(res.body.signature).toBe(expected);
    expect(res.body.cloudName).toBe("demo-cloud");
    expect(JSON.stringify(res.body)).not.toContain("shhh-test-secret");
  });
});

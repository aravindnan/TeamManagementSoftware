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

const request = require("supertest");
const mongoose = require("mongoose");
const { MongoMemoryServer } = require("mongodb-memory-server");

let mongod, app, User, Invite, Workspace, Project, Task, Notification;
const config = require("../config/env");

const agent = () => request.agent(app);
const userBody = (n) => ({
  username: `user${n}`, email: `user${n}@example.com`, password: "Passw0rd!x",
  firstName: `First${n}`, lastName: `Last${n}`, role: "Dev", dateOfBirth: "1990-01-01",
});

/** Registers and logs in user n. `verified` marks the address as verified (as a Google sign-in would). */
async function signup(n, { verified = false } = {}) {
  const a = agent();
  await a.post("/register").send(userBody(n)).expect(201);
  const res = await a.post("/login").send({ username: `user${n}`, password: "Passw0rd!x" }).expect(200);
  if (verified) await User.updateOne({ _id: res.body.userId }, { emailVerified: true });
  return { a, id: res.body.userId, email: `user${n}@example.com`, n };
}
const makeWorkspace = async (owner, name = "Acme") => (await owner.a.post("/workspaces").send({ name }).expect(201)).body._id;
const tokenOf = (link) => link.split("/invite/")[1];
const invite = (u, wsId, body) => u.a.post(`/workspaces/${wsId}/invites`).send(body);
const inboxTypes = async (u) => (await u.a.get("/notifications")).body.items.map((x) => x.type);

beforeAll(async () => {
  mongod = await MongoMemoryServer.create();
  process.env.MONGO_URI = mongod.getUri();
  const { connectToDatabase } = require("../config/database");
  await connectToDatabase(process.env.MONGO_URI);
  app = require("../app").createApp();
  User = require("../model/user");
  Invite = require("../model/invite");
  Workspace = require("../model/workspace");
  Project = require("../model/project");
  Task = require("../model/task");
  Notification = require("../model/notification");
});
afterAll(async () => {
  await mongoose.disconnect();
  await mongod.stop();
});
beforeEach(async () => {
  await mongoose.connection.db.dropDatabase();
  await Promise.all(Object.values(mongoose.models).map((m) => m.syncIndexes()));
});

// A workspace with an owner, an admin and a plain member already inside.
async function team() {
  const owner = await signup(1, { verified: true });
  const admin = await signup(2, { verified: true });
  const member = await signup(3, { verified: true });
  const outsider = await signup(4, { verified: true });
  const wsId = await makeWorkspace(owner);
  const join = async (u, role) => {
    const link = (await invite(owner, wsId, { email: u.email, role }).expect(201)).body.link;
    await u.a.post("/invites/accept").send({ token: tokenOf(link) }).expect(200);
  };
  await join(admin, "admin");
  await join(member, "member");
  return { owner, admin, member, outsider, wsId };
}

describe("workspaces", () => {
  test("anyone can create one and becomes its owner; names are validated", async () => {
    const u = await signup(1);
    const res = await u.a.post("/workspaces").send({ name: "  Acme Co  " }).expect(201);
    expect(res.body).toMatchObject({ name: "Acme Co", myRole: "owner", memberCount: 1, projectCount: 0 });
    const list = (await u.a.get("/workspaces").expect(200)).body;
    expect(list).toHaveLength(1);
    expect(list[0].myRole).toBe("owner");
    await u.a.post("/workspaces").send({ name: "x" }).expect(400);
    await u.a.post("/workspaces").send({ name: "x".repeat(61) }).expect(400);
    await u.a.post("/workspaces").send({}).expect(400);
  });

  test("requires a session", async () => {
    await request(app).get("/workspaces").expect(401);
    await request(app).post("/workspaces").send({ name: "Nope" }).expect(401);
  });

  test("a person can own at most 20 workspaces", async () => {
    const u = await signup(1);
    for (let i = 0; i < 20; i++) await u.a.post("/workspaces").send({ name: `WS ${i}` }).expect(201);
    await u.a.post("/workspaces").send({ name: "One too many" }).expect(409);
  });

  test("members see the roster with public fields only; non-members get 404 (existence is not revealed)", async () => {
    const { owner, member, outsider, wsId } = await team();
    const ws = (await member.a.get(`/workspaces/${wsId}`).expect(200)).body;
    expect(ws).toMatchObject({ myRole: "member", owner: owner.id });
    expect(ws.members.map((m) => m.role).sort()).toEqual(["admin", "member", "owner"]);
    for (const m of ws.members) {
      expect(m.user.password).toBeUndefined();
      expect(m.user.dateOfBirth).toBeUndefined();
      expect(m.user.firstName).toBeDefined();
    }
    await outsider.a.get(`/workspaces/${wsId}`).expect(404);
    await outsider.a.get("/workspaces/aaaaaaaaaaaaaaaaaaaaaaaa").expect(404);
    await outsider.a.get("/workspaces/not-an-id").expect(400);
    expect((await outsider.a.get("/workspaces")).body).toEqual([]);
  });

  test("owners and admins can rename; members cannot", async () => {
    const { admin, member, outsider, wsId } = await team();
    await admin.a.patch(`/workspaces/${wsId}`).send({ name: "Renamed" }).expect(200);
    await member.a.patch(`/workspaces/${wsId}`).send({ name: "Hax" }).expect(403);
    await outsider.a.patch(`/workspaces/${wsId}`).send({ name: "Hax" }).expect(404);
    expect((await Workspace.findById(wsId)).name).toBe("Renamed");
  });

  test("only the owner can delete, and not while projects remain", async () => {
    const { owner, admin, wsId } = await team();
    await admin.a.delete(`/workspaces/${wsId}`).expect(403);
    const p = await owner.a.post(`/create-new-project-for-user-id/${owner.id}`).send({ projectName: "P", workspaceId: wsId }).expect(201);
    const blocked = await owner.a.delete(`/workspaces/${wsId}`).expect(409);
    expect(blocked.body.error).toMatch(/1 project/);
    await owner.a.delete(`/delete-project-by-id/${p.body.project._id}`).expect(200);
    await invite(owner, wsId, { email: "someone@example.com" }).expect(201);
    await owner.a.delete(`/workspaces/${wsId}`).expect(200);
    expect(await Workspace.countDocuments()).toBe(0);
    expect(await Invite.countDocuments()).toBe(0); // its invitations go with it
  });
});

describe("roles and ownership", () => {
  test("only the owner changes roles, never the owner's own, and only to admin or member", async () => {
    const { owner, admin, member, wsId } = await team();
    await owner.a.patch(`/workspaces/${wsId}/members/${member.id}`).send({ role: "admin" }).expect(200);
    await owner.a.patch(`/workspaces/${wsId}/members/${member.id}`).send({ role: "member" }).expect(200);
    await admin.a.patch(`/workspaces/${wsId}/members/${member.id}`).send({ role: "admin" }).expect(403);
    await owner.a.patch(`/workspaces/${wsId}/members/${owner.id}`).send({ role: "member" }).expect(409);
    await owner.a.patch(`/workspaces/${wsId}/members/${member.id}`).send({ role: "owner" }).expect(400); // no back door to ownership
    await owner.a.patch(`/workspaces/${wsId}/members/${(await signup(9)).id}`).send({ role: "admin" }).expect(404);
  });

  test("ownership can be transferred to a member; the old owner becomes an admin", async () => {
    const { owner, admin, member, outsider, wsId } = await team();
    await admin.a.post(`/workspaces/${wsId}/transfer`).send({ userId: admin.id }).expect(403);
    await owner.a.post(`/workspaces/${wsId}/transfer`).send({ userId: owner.id }).expect(400);
    await owner.a.post(`/workspaces/${wsId}/transfer`).send({ userId: outsider.id }).expect(400); // must already be in
    await owner.a.post(`/workspaces/${wsId}/transfer`).send({ userId: member.id }).expect(200);
    const ws = (await member.a.get(`/workspaces/${wsId}`)).body;
    expect(ws.owner).toBe(member.id);
    expect(ws.myRole).toBe("owner");
    expect(ws.members.find((m) => m.user._id === owner.id).role).toBe("admin");
    expect(ws.members.filter((m) => m.role === "owner")).toHaveLength(1);
    await owner.a.delete(`/workspaces/${wsId}`).expect(403); // no longer theirs to delete
  });

  test("who can remove whom", async () => {
    const { owner, admin, member, wsId } = await team();
    const second = await signup(5, { verified: true });
    const third = await signup(6, { verified: true });
    for (const u of [second, third]) {
      const link = (await invite(owner, wsId, { email: u.email, role: "member" })).body.link;
      await u.a.post("/invites/accept").send({ token: tokenOf(link) }).expect(200);
    }
    await member.a.delete(`/workspaces/${wsId}/members/${second.id}`).expect(403); // a member cannot remove others
    await admin.a.delete(`/workspaces/${wsId}/members/${owner.id}`).expect(409); // the owner cannot be removed
    await admin.a.delete(`/workspaces/${wsId}/members/${admin.id}`).expect(200); // anyone may leave... (admin leaves)
    await admin.a.get(`/workspaces/${wsId}`).expect(404);
    await owner.a.delete(`/workspaces/${wsId}/members/${second.id}`).expect(200);
    await third.a.delete(`/workspaces/${wsId}/members/${third.id}`).expect(200); // a member may leave
    expect((await owner.a.get(`/workspaces/${wsId}`)).body.members).toHaveLength(2);
    await owner.a.delete(`/workspaces/${wsId}/members/${second.id}`).expect(404); // already gone
  });

  test("an admin cannot remove another admin, but the owner can; the owner cannot leave", async () => {
    const { owner, admin, member, wsId } = await team();
    await owner.a.patch(`/workspaces/${wsId}/members/${member.id}`).send({ role: "admin" }).expect(200);
    await admin.a.delete(`/workspaces/${wsId}/members/${member.id}`).expect(403);
    const leaving = await owner.a.delete(`/workspaces/${wsId}/members/${owner.id}`).expect(409);
    expect(leaving.body.error).toMatch(/transfer ownership/i);
    await owner.a.delete(`/workspaces/${wsId}/members/${member.id}`).expect(200);
  });
});

describe("removing someone cleans up their work", () => {
  async function withProject() {
    const t = await team();
    const projectId = (await t.owner.a.post(`/create-new-project-for-user-id/${t.owner.id}`).send({ projectName: "P", workspaceId: t.wsId })).body.project._id;
    await t.owner.a.post(`/add-new-member-by-project-id/${projectId}`).send({ memberId: t.member.id }).expect(200);
    return { ...t, projectId };
  }

  test("they leave the workspace's projects and their tasks go to the project manager", async () => {
    const { owner, member, wsId, projectId } = await withProject();
    const task = (await owner.a.post(`/add-new-task-by-project-id/${projectId}`).send({ taskTitle: "T", assignedTo: member.id })).body.taskId;
    const res = await owner.a.delete(`/workspaces/${wsId}/members/${member.id}`).expect(200);
    expect(res.body.projectsAffected).toBe(1);
    const project = await Project.findById(projectId);
    expect(project.projectMembers.map(String)).not.toContain(member.id);
    expect(String((await Task.findById(task)).assignedTo)).toBe(owner.id);
    const gone = await User.findById(member.id);
    expect(gone.involvedProjects).toHaveLength(0);
    expect(gone.allTasks).toHaveLength(0);
    const feed = (await owner.a.get(`/get-project-activity-by-id/${projectId}`)).body.items;
    expect(feed[0]).toMatchObject({ verb: "member.removed", data: { reassigned: 1 } });
  });

  test("projects they managed pass to the workspace owner", async () => {
    const { owner, admin, member, wsId } = await withProject();
    // the member becomes an admin so they can create and manage a project of their own
    const theirs = (await member.a.post(`/create-new-project-for-user-id/${member.id}`).send({ projectName: "Theirs", workspaceId: wsId }).expect(201)).body.project._id;
    await member.a.post(`/add-new-member-by-project-id/${theirs}`).send({ memberId: owner.id }).expect(200);
    const task = (await member.a.post(`/add-new-task-by-project-id/${theirs}`).send({ taskTitle: "Mine", assignedTo: member.id })).body.taskId;

    await owner.a.delete(`/workspaces/${wsId}/members/${member.id}`).expect(200);
    const project = await Project.findById(theirs);
    expect(String(project.projectManager)).toBe(owner.id);
    expect(project.projectMembers.map(String)).not.toContain(member.id);
    expect(String((await Task.findById(task)).assignedTo)).toBe(owner.id);
    const newManager = await User.findById(owner.id);
    expect(newManager.myProjects.map(String)).toContain(theirs);
    expect((await User.findById(member.id)).myProjects).toHaveLength(0);
    // and the new manager can actually manage it
    await owner.a.put(`/edit-project-by-id/${theirs}`).send({ projectName: "Now ours", projectStatus: "In Progress" }).expect(200);
    await admin.a.get("/me").expect(200);
  });

  test("projects in other workspaces are untouched", async () => {
    const { owner, member, wsId } = await withProject();
    const otherWs = await makeWorkspace(owner, "Other");
    const link = (await invite(owner, otherWs, { email: member.email })).body.link;
    await member.a.post("/invites/accept").send({ token: tokenOf(link) }).expect(200);
    const otherProject = (await owner.a.post(`/create-new-project-for-user-id/${owner.id}`).send({ projectName: "Elsewhere", workspaceId: otherWs })).body.project._id;
    await owner.a.post(`/add-new-member-by-project-id/${otherProject}`).send({ memberId: member.id }).expect(200);
    await owner.a.delete(`/workspaces/${wsId}/members/${member.id}`).expect(200);
    expect((await Project.findById(otherProject)).projectMembers.map(String)).toContain(member.id);
  });
});

describe("workspaces and projects", () => {
  test("a project can only be created in a workspace you belong to, and shows its workspace", async () => {
    const { owner, outsider, wsId } = await team();
    await outsider.a.post(`/create-new-project-for-user-id/${outsider.id}`).send({ projectName: "P", workspaceId: wsId }).expect(403);
    const p = (await owner.a.post(`/create-new-project-for-user-id/${owner.id}`).send({ projectName: "P", workspaceId: wsId }).expect(201)).body.project;
    expect(String(p.workspace)).toBe(wsId);
    const full = (await owner.a.get(`/get-project-by-id/${p._id}`)).body;
    expect(full.workspace).toMatchObject({ _id: wsId, name: "Acme" });
    expect((await owner.a.get("/workspaces")).body[0].projectCount).toBe(1);
  });

  test("projects created without a workspace still work (older data)", async () => {
    const u = await signup(1);
    await u.a.post(`/create-new-project-for-user-id/${u.id}`).send({ projectName: "Legacy" }).expect(201);
  });

  test("only people in the workspace can be added to its projects", async () => {
    const { owner, outsider, wsId } = await team();
    const projectId = (await owner.a.post(`/create-new-project-for-user-id/${owner.id}`).send({ projectName: "P", workspaceId: wsId })).body.project._id;
    const refused = await owner.a.post(`/add-new-member-by-project-id/${projectId}`).send({ memberId: outsider.id }).expect(400);
    expect(refused.body.error).toMatch(/workspace first/i);
    const link = (await invite(owner, wsId, { email: outsider.email })).body.link;
    await outsider.a.post("/invites/accept").send({ token: tokenOf(link) }).expect(200);
    await owner.a.post(`/add-new-member-by-project-id/${projectId}`).send({ memberId: outsider.id }).expect(200);
  });

  test("the user directory only shows people you share a workspace with", async () => {
    const { owner, member, outsider } = await team();
    const seen = async (u) => (await u.a.get("/get-all-users").expect(200)).body.map((x) => x.username).sort();
    expect(await seen(member)).toEqual(["user1", "user2", "user3"]); // the whole workspace, including themselves
    expect(await seen(outsider)).toEqual([]); // sees nobody, and nobody sees them
    expect(await seen(owner)).not.toContain("user4");
  });

  test("an account that owns a workspace cannot be deleted until ownership moves; otherwise memberships are dropped", async () => {
    const { owner, member, wsId } = await team();
    await owner.a.delete(`/delete-user/${owner.id}`).expect(409);
    await member.a.delete(`/delete-user/${member.id}`).expect(200);
    expect((await Workspace.findById(wsId)).members.map((m) => String(m.user))).not.toContain(member.id);
  });
});

describe("invitations: creating and managing", () => {
  test("admins create invites; the link works, only a hash is stored, and the token is never listed", async () => {
    const { owner, admin, member, wsId } = await team();
    const res = await invite(admin, wsId, { email: "New.Person@Example.com" }).expect(201);
    expect(res.body.link.startsWith(`${config.publicClientUrl}/invite/`)).toBe(true);
    expect(res.body.invite).toMatchObject({ email: "new.person@example.com", role: "member", status: "pending" });
    expect(res.body.invite.tokenHash).toBeUndefined();

    const token = tokenOf(res.body.link);
    expect(token.length).toBeGreaterThanOrEqual(40);
    const stored = await Invite.findOne({ email: "new.person@example.com" });
    expect(stored.tokenHash).toBe(Invite.hashToken(token));
    expect(JSON.stringify(stored.toObject())).not.toContain(token); // the secret itself is not in the database

    const listed = (await owner.a.get(`/workspaces/${wsId}/invites`).expect(200)).body;
    expect(listed).toHaveLength(1);
    expect(JSON.stringify(listed)).not.toContain(token);
    expect(listed[0].tokenHash).toBeUndefined();
    await member.a.get(`/workspaces/${wsId}/invites`).expect(403);
  });

  test("members cannot invite; outsiders cannot even see the workspace; emails are validated", async () => {
    const { member, outsider, wsId } = await team();
    await invite(member, wsId, { email: "x@example.com" }).expect(403);
    await invite(outsider, wsId, { email: "x@example.com" }).expect(404);
    const owner = await signup(7);
    const own = await makeWorkspace(owner, "Mine");
    for (const email of ["", "not-an-email", "a@b", "x".repeat(300) + "@example.com"]) await invite(owner, own, { email }).expect(400);
    await invite(owner, own, { email: "ok@example.com", role: "owner" }).expect(400); // there is no owner invite
  });

  test("only the owner can invite someone as an admin", async () => {
    const { owner, admin, wsId } = await team();
    await invite(admin, wsId, { email: "a@example.com", role: "admin" }).expect(403);
    const ok = await invite(owner, wsId, { email: "a@example.com", role: "admin" }).expect(201);
    expect(ok.body.invite.role).toBe("admin");
  });

  test("you cannot invite someone who is already in", async () => {
    const { owner, member, wsId } = await team();
    const res = await invite(owner, wsId, { email: member.email }).expect(409);
    expect(res.body.error).toMatch(/already in this workspace/i);
  });

  test("a new invitation to the same address replaces the old one", async () => {
    const { owner, wsId } = await team();
    const first = (await invite(owner, wsId, { email: "dup@example.com" })).body;
    const second = (await invite(owner, wsId, { email: "dup@example.com" })).body;
    expect(first.link).not.toBe(second.link);
    const listed = (await owner.a.get(`/workspaces/${wsId}/invites`)).body;
    expect(listed).toHaveLength(1);
    expect(listed[0]._id).toBe(second.invite._id);
    const old = await request(app).get(`/invites/preview/${tokenOf(first.link)}`).expect(200);
    expect(old.body.status).toBe("revoked");
  });

  test("there is a cap on pending invitations", async () => {
    const { owner, wsId } = await team();
    for (let i = 0; i < 50; i++) await invite(owner, wsId, { email: `p${i}@example.com` }).expect(201);
    await invite(owner, wsId, { email: "p50@example.com" }).expect(409);
  });

  test("regenerating gives a fresh link and kills the old one; revoked or accepted invites cannot be regenerated", async () => {
    const { owner, outsider, wsId } = await team();
    const created = (await invite(owner, wsId, { email: outsider.email })).body;
    const id = created.invite._id;
    const regen = (await owner.a.post(`/workspaces/${wsId}/invites/${id}/regenerate`).expect(200)).body;
    expect(regen.link).not.toBe(created.link);
    await request(app).get(`/invites/preview/${tokenOf(created.link)}`).expect(404); // old link is dead
    expect((await request(app).get(`/invites/preview/${tokenOf(regen.link)}`).expect(200)).body.status).toBe("pending");

    await owner.a.delete(`/workspaces/${wsId}/invites/${id}`).expect(200);
    await owner.a.post(`/workspaces/${wsId}/invites/${id}/regenerate`).expect(410);
    await owner.a.post(`/workspaces/${wsId}/invites/aaaaaaaaaaaaaaaaaaaaaaaa/regenerate`).expect(404);
  });

  test("an invitation cannot be managed through a different workspace", async () => {
    const { owner, wsId } = await team();
    const other = await signup(8);
    const otherWs = await makeWorkspace(other, "Other");
    const id = (await invite(owner, wsId, { email: "z@example.com" })).body.invite._id;
    await other.a.delete(`/workspaces/${otherWs}/invites/${id}`).expect(404);
    await other.a.post(`/workspaces/${otherWs}/invites/${id}/regenerate`).expect(404);
    expect((await owner.a.get(`/workspaces/${wsId}/invites`)).body).toHaveLength(1);
  });

  test("expired invitations disappear from the pending list", async () => {
    const { owner, wsId } = await team();
    const created = (await invite(owner, wsId, { email: "old@example.com" })).body;
    await Invite.updateOne({ _id: created.invite._id }, { expiresAt: new Date(Date.now() - 1000) });
    expect((await owner.a.get(`/workspaces/${wsId}/invites`)).body).toEqual([]);
    expect((await request(app).get(`/invites/preview/${tokenOf(created.link)}`)).body.status).toBe("expired");
  });
});

describe("invitations: the person invited", () => {
  test("the public preview says what the invitation is for, and leaks nothing else", async () => {
    const { owner, outsider, wsId } = await team();
    const { link } = (await invite(owner, wsId, { email: outsider.email, role: "admin" })).body;
    const res = await request(app).get(`/invites/preview/${tokenOf(link)}`).expect(200); // no session needed
    expect(res.body).toEqual({ workspaceName: "Acme", inviterName: "First1 Last1", email: outsider.email, role: "admin", status: "pending" });
    await request(app).get(`/invites/preview/${"x".repeat(43)}`).expect(404);
    await request(app).get("/invites/preview/short").expect(400);
  });

  test("accepting with the link adds them with the invited role and tells the inviter", async () => {
    const { owner, outsider, wsId } = await team();
    const { link, invite: inv } = (await invite(owner, wsId, { email: outsider.email, role: "admin" })).body;
    const res = await outsider.a.post("/invites/accept").send({ token: tokenOf(link) }).expect(200);
    expect(res.body.workspace).toEqual({ _id: wsId, name: "Acme" });
    expect((await outsider.a.get(`/workspaces/${wsId}`)).body.myRole).toBe("admin");
    expect((await Invite.findById(inv._id)).acceptedBy.toString()).toBe(outsider.id);
    expect(await inboxTypes(owner)).toContain("workspace.joined");
    expect((await request(app).get(`/invites/preview/${tokenOf(link)}`)).body.status).toBe("accepted");
  });

  test("accepting needs a session, a real token, and the address the invitation was sent to", async () => {
    const { owner, outsider, wsId } = await team();
    const stranger = await signup(9, { verified: true });
    const { link } = (await invite(owner, wsId, { email: outsider.email })).body;
    const token = tokenOf(link);
    await request(app).post("/invites/accept").send({ token }).expect(401);
    await outsider.a.post("/invites/accept").send({ token: "y".repeat(43) }).expect(404);
    await outsider.a.post("/invites/accept").send({ token: "short" }).expect(400);
    const wrong = await stranger.a.post("/invites/accept").send({ token }).expect(403);
    expect(wrong.body.error).toMatch(/different email/i);
    await stranger.a.get(`/workspaces/${wsId}`).expect(404); // and it did not let them in
    expect((await Invite.findOne({ email: outsider.email })).acceptedAt).toBeUndefined();
    await outsider.a.post("/invites/accept").send({ token }).expect(200); // the right person still can
  });

  test("revoked, expired or already-used invitations are refused (410)", async () => {
    const { owner, outsider, wsId } = await team();
    const revoked = (await invite(owner, wsId, { email: outsider.email })).body;
    await owner.a.delete(`/workspaces/${wsId}/invites/${revoked.invite._id}`).expect(200);
    await outsider.a.post("/invites/accept").send({ token: tokenOf(revoked.link) }).expect(410);

    const expired = (await invite(owner, wsId, { email: outsider.email })).body;
    await Invite.updateOne({ _id: expired.invite._id }, { expiresAt: new Date(Date.now() - 1000) });
    await outsider.a.post("/invites/accept").send({ token: tokenOf(expired.link) }).expect(410);
    await outsider.a.get(`/workspaces/${wsId}`).expect(404);
  });

  test("a leaked link is useless to anyone else once the invitee has used it", async () => {
    const { owner, outsider, wsId } = await team();
    const { link } = (await invite(owner, wsId, { email: outsider.email })).body;
    await outsider.a.post("/invites/accept").send({ token: tokenOf(link) }).expect(200);
    const later = await signup(10, { verified: true });
    await later.a.post("/invites/accept").send({ token: tokenOf(link) }).expect(403);
  });

  test("accepting twice, even simultaneously, results in one membership", async () => {
    const { owner, outsider, wsId } = await team();
    const { link } = (await invite(owner, wsId, { email: outsider.email })).body;
    const token = tokenOf(link);
    const results = await Promise.all([1, 2, 3].map(() => outsider.a.post("/invites/accept").send({ token })));
    for (const r of results) expect([200, 410]).toContain(r.status);
    expect(results.some((r) => r.status === 200)).toBe(true);
    const ws = await Workspace.findById(wsId);
    expect(ws.members.filter((m) => String(m.user) === outsider.id)).toHaveLength(1);
    await outsider.a.post("/invites/accept").send({ token }).expect(200); // idempotent once they are in
  });

  test("existing members can still use an old link without error", async () => {
    const { owner, member, wsId } = await team();
    const stale = new Invite({
      workspace: wsId, email: member.email, role: "admin", tokenHash: Invite.hashToken("z".repeat(43)), invitedBy: owner.id, expiresAt: new Date(Date.now() + 1e6),
    });
    await stale.save();
    await member.a.post("/invites/accept").send({ token: "z".repeat(43) }).expect(200);
    expect((await member.a.get(`/workspaces/${wsId}`)).body.myRole).toBe("member"); // did not escalate to admin
  });
});

describe("invitations in the app (verified addresses only)", () => {
  test("a person with a verified email sees invitations addressed to them, and gets a notification", async () => {
    const { owner, outsider, wsId } = await team(); // outsider is verified
    await invite(owner, wsId, { email: outsider.email });
    const mine = (await outsider.a.get("/invites/mine").expect(200)).body;
    expect(mine).toHaveLength(1);
    expect(mine[0]).toMatchObject({ workspaceName: "Acme", inviterName: "First1 Last1", role: "member", status: "pending" });
    expect(mine[0].tokenHash).toBeUndefined();
    expect(await inboxTypes(outsider)).toContain("workspace.invited");
  });

  test("an UNVERIFIED account sees nothing and is told nothing (anyone could have typed that address)", async () => {
    const owner = await signup(1);
    const wsId = await makeWorkspace(owner);
    const victimSquatter = await signup(2); // registered with a password; email never verified
    const { invite: inv } = (await invite(owner, wsId, { email: victimSquatter.email })).body;
    expect((await victimSquatter.a.get("/invites/mine").expect(200)).body).toEqual([]);
    expect(await inboxTypes(victimSquatter)).not.toContain("workspace.invited");
    const refused = await victimSquatter.a.post(`/invites/${inv._id}/accept`).expect(403);
    expect(refused.body.error).toMatch(/link|google/i);
    await victimSquatter.a.get(`/workspaces/${wsId}`).expect(404);
  });

  test("accepting in the app joins the workspace; declining revokes the invitation", async () => {
    const { owner, outsider, wsId } = await team();
    const { invite: inv } = (await invite(owner, wsId, { email: outsider.email })).body;
    await outsider.a.post(`/invites/${inv._id}/accept`).expect(200);
    expect((await outsider.a.get(`/workspaces/${wsId}`)).body.myRole).toBe("member");
    expect((await outsider.a.get("/invites/mine")).body).toEqual([]);

    const other = await signup(11, { verified: true });
    const second = (await invite(owner, wsId, { email: other.email })).body.invite;
    await other.a.post(`/invites/${second._id}/decline`).expect(200);
    expect((await Invite.findById(second._id)).revokedAt).toBeDefined();
    await other.a.post(`/invites/${second._id}/accept`).expect(410);
    expect((await owner.a.get(`/workspaces/${wsId}/invites`)).body).toEqual([]);
  });

  test("you cannot act on an invitation addressed to someone else, even a verified user", async () => {
    const { owner, outsider, wsId } = await team();
    const snoop = await signup(12, { verified: true });
    const { invite: inv } = (await invite(owner, wsId, { email: outsider.email })).body;
    expect((await snoop.a.get("/invites/mine")).body).toEqual([]);
    await snoop.a.post(`/invites/${inv._id}/accept`).expect(403);
    await snoop.a.post(`/invites/${inv._id}/decline`).expect(403);
    expect((await Invite.findById(inv._id)).revokedAt).toBeUndefined();
    await snoop.a.post("/invites/aaaaaaaaaaaaaaaaaaaaaaaa/accept").expect(404);
    await snoop.a.post("/invites/nope/accept").expect(400);
  });
});

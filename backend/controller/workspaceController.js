const mongoose = require("mongoose");
const Workspace = require("../model/workspace");
const Invite = require("../model/invite");
const Project = require("../model/project");
const User = require("../model/user");
const Notification = require("../model/notification");
const config = require("../config/env");
const asyncHandler = require("../utils/asyncHandler");
const { AppError, badRequest, forbidden, notFound, conflict } = require("../utils/AppError");
const { PUBLIC_USER_FIELDS } = require("../utils/access");
const { RANK, roleOf, loadWorkspaceForMember, loadWorkspaceWithRole } = require("../utils/workspaceAccess");
const { removeMemberFromProject } = require("../utils/projectMembers");
const { logActivity, fullName } = require("../utils/activity");

const MAX_OWNED_WORKSPACES = 20;
const MAX_MEMBERS = 100;
const MAX_PENDING_INVITES = 50;

const inviteLink = (token) => `${config.publicClientUrl}/invite/${token}`;
const publicInvite = (inv) => ({
  _id: inv._id, email: inv.email, role: inv.role, createdAt: inv.createdAt, expiresAt: inv.expiresAt, status: inv.status(),
});
const pendingFilter = (extra = {}) => ({ acceptedAt: null, revokedAt: null, expiresAt: { $gt: new Date() }, ...extra });

// ================================================================ workspaces

exports.list = asyncHandler(async (req, res) => {
  const workspaces = await Workspace.find({ "members.user": req.user.id }).sort({ name: 1 }).lean();
  const counts = await Project.aggregate([
    { $match: { workspace: { $in: workspaces.map((w) => w._id) }, projectMembers: new mongoose.Types.ObjectId(req.user.id) } },
    { $group: { _id: "$workspace", n: { $sum: 1 } } },
  ]);
  const projectCount = Object.fromEntries(counts.map((c) => [String(c._id), c.n]));
  res.status(200).json(
    workspaces.map((w) => ({
      _id: w._id,
      name: w.name,
      myRole: roleOf(w, req.user.id),
      memberCount: w.members.length,
      projectCount: projectCount[String(w._id)] || 0,
    }))
  );
});

exports.create = asyncHandler(async (req, res) => {
  if ((await Workspace.countDocuments({ owner: req.user.id })) >= MAX_OWNED_WORKSPACES) {
    throw conflict(`You can own at most ${MAX_OWNED_WORKSPACES} workspaces`);
  }
  const workspace = await Workspace.create({ name: req.body.name, owner: req.user.id, members: [{ user: req.user.id, role: "owner" }] });
  res.status(201).json({ _id: workspace._id, name: workspace.name, myRole: "owner", memberCount: 1, projectCount: 0 });
});

exports.get = asyncHandler(async (req, res) => {
  const { workspace, role } = await loadWorkspaceForMember(req.params.workspaceId, req.user.id);
  await workspace.populate("members.user", PUBLIC_USER_FIELDS);
  const projectCount = await Project.countDocuments({ workspace: workspace._id, projectMembers: req.user.id });
  res.status(200).json({
    _id: workspace._id,
    name: workspace.name,
    owner: String(workspace.owner),
    myRole: role,
    projectCount,
    members: workspace.members
      .filter((m) => m.user) // a deleted account leaves no ghost row
      .map((m) => ({ user: m.user, role: m.role, joinedAt: m.joinedAt })),
  });
});

exports.rename = asyncHandler(async (req, res) => {
  const { workspace } = await loadWorkspaceWithRole(req.params.workspaceId, req.user.id, "admin");
  workspace.name = req.body.name;
  await workspace.save();
  res.status(200).json({ _id: workspace._id, name: workspace.name });
});

exports.remove = asyncHandler(async (req, res) => {
  const { workspace } = await loadWorkspaceWithRole(req.params.workspaceId, req.user.id, "owner");
  const projects = await Project.countDocuments({ workspace: workspace._id });
  if (projects > 0) throw conflict(`This workspace still has ${projects} project${projects === 1 ? "" : "s"}. Delete or move them first.`);
  await Promise.all([Invite.deleteMany({ workspace: workspace._id }), Workspace.deleteOne({ _id: workspace._id })]);
  res.status(200).json({ deleted: true });
});

// ================================================================ members

exports.setRole = asyncHandler(async (req, res) => {
  const { workspace } = await loadWorkspaceWithRole(req.params.workspaceId, req.user.id, "owner");
  const targetRole = roleOf(workspace, req.params.userId);
  if (!targetRole) throw notFound("That person is not in this workspace");
  if (targetRole === "owner") throw conflict("The owner's role cannot be changed. Transfer ownership instead.");
  await Workspace.updateOne({ _id: workspace._id, "members.user": req.params.userId }, { $set: { "members.$.role": req.body.role } });
  res.status(200).json({ userId: req.params.userId, role: req.body.role });
});

exports.removeMember = asyncHandler(async (req, res) => {
  const { workspace, role } = await loadWorkspaceForMember(req.params.workspaceId, req.user.id);
  const userId = req.params.userId;
  const leaving = userId === req.user.id;
  const targetRole = roleOf(workspace, userId);
  if (!targetRole) throw notFound("That person is not in this workspace");

  if (targetRole === "owner") {
    throw conflict(leaving ? "You own this workspace. Transfer ownership or delete it instead of leaving." : "The owner cannot be removed.");
  }
  if (!leaving) {
    if (RANK[role] < RANK.admin) throw forbidden("Only workspace admins can remove people");
    if (targetRole === "admin" && role !== "owner") throw forbidden("Only the owner can remove an admin");
  }

  const leaver = await User.findById(userId).select("firstName lastName").lean();
  const ownerId = String(workspace.owner);

  // Take them off every project in the workspace. Projects they managed pass to the workspace owner,
  // and their tasks go to whoever manages the project, so nothing is left orphaned.
  const projects = await Project.find({ workspace: workspace._id, $or: [{ projectMembers: userId }, { projectManager: userId }] });
  for (const project of projects) {
    if (String(project.projectManager) === userId) {
      await Project.updateOne({ _id: project._id }, { projectManager: ownerId, $addToSet: { projectMembers: ownerId } });
      await User.updateOne({ _id: ownerId }, { $addToSet: { myProjects: project._id }, $pull: { involvedProjects: project._id } });
      await User.updateOne({ _id: userId }, { $pull: { myProjects: project._id } });
      project.projectManager = ownerId;
    }
    const reassigned = await removeMemberFromProject(project, userId);
    await logActivity(req.user.id, project._id, "member.removed", { data: { memberName: fullName(leaver), reassigned } });
  }

  await Workspace.updateOne({ _id: workspace._id }, { $pull: { members: { user: userId } } });
  res.status(200).json({ removed: true, projectsAffected: projects.length });
});

exports.transferOwnership = asyncHandler(async (req, res) => {
  const { workspace } = await loadWorkspaceWithRole(req.params.workspaceId, req.user.id, "owner");
  const target = req.body.userId;
  if (target === req.user.id) throw badRequest("You already own this workspace");
  if (!roleOf(workspace, target)) throw badRequest("The new owner must already be in the workspace");
  await Workspace.updateOne({ _id: workspace._id }, { owner: target, $set: { "members.$[new].role": "owner", "members.$[old].role": "admin" } }, {
    arrayFilters: [{ "new.user": new mongoose.Types.ObjectId(target) }, { "old.user": new mongoose.Types.ObjectId(req.user.id) }],
  });
  res.status(200).json({ owner: target });
});

// ================================================================ invites (managed by admins)

async function notifyIfKnown(email, workspace, role, inviteId, inviterName) {
  // Only people whose email we have verified see invitations addressed to that email in the app. For an
  // unverified password account anyone could have typed that address, so they need the secret link.
  const user = await User.findOne({ email, emailVerified: true }).select("_id");
  if (!user) return;
  await Notification.create({ user: user._id, type: "workspace.invited", actorName: inviterName, data: { workspaceName: workspace.name, role, inviteId: String(inviteId) } });
}

exports.createInvite = asyncHandler(async (req, res) => {
  const { workspace, role: myRole } = await loadWorkspaceWithRole(req.params.workspaceId, req.user.id, "admin");
  const { email, role } = req.body;
  if (role === "admin" && myRole !== "owner") throw forbidden("Only the owner can invite someone as an admin");
  if (workspace.members.length >= MAX_MEMBERS) throw conflict(`A workspace can have at most ${MAX_MEMBERS} members`);

  const existing = await User.findOne({ email }).select("_id");
  if (existing && roleOf(workspace, existing._id)) throw conflict("That person is already in this workspace");
  if ((await Invite.countDocuments(pendingFilter({ workspace: workspace._id }))) >= MAX_PENDING_INVITES) {
    throw conflict(`There are already ${MAX_PENDING_INVITES} pending invitations. Revoke some first.`);
  }

  // One live invitation per address: a new one replaces the old.
  await Invite.updateMany({ workspace: workspace._id, email, acceptedAt: null, revokedAt: null }, { revokedAt: new Date() });
  const token = Invite.newToken();
  const invite = await Invite.create({
    workspace: workspace._id, email, role, tokenHash: Invite.hashToken(token), invitedBy: req.user.id, expiresAt: new Date(Date.now() + Invite.ttlMs),
  });
  const inviter = await User.findById(req.user.id).select("firstName lastName").lean();
  await notifyIfKnown(email, workspace, role, invite._id, fullName(inviter));

  // The link is only ever returned here and on regenerate: the database holds just its hash.
  res.status(201).json({ invite: publicInvite(invite), link: inviteLink(token) });
});

exports.listInvites = asyncHandler(async (req, res) => {
  const { workspace } = await loadWorkspaceWithRole(req.params.workspaceId, req.user.id, "admin");
  const invites = await Invite.find(pendingFilter({ workspace: workspace._id })).sort({ createdAt: -1 });
  res.status(200).json(invites.map(publicInvite));
});

exports.regenerateInvite = asyncHandler(async (req, res) => {
  const { workspace, role: myRole } = await loadWorkspaceWithRole(req.params.workspaceId, req.user.id, "admin");
  const invite = await Invite.findOne({ _id: req.params.inviteId, workspace: workspace._id });
  if (!invite) throw notFound("Invitation not found");
  if (invite.acceptedAt || invite.revokedAt) throw new AppError(410, "This invitation is no longer valid");
  if (invite.role === "admin" && myRole !== "owner") throw forbidden("Only the owner can manage admin invitations");
  const token = Invite.newToken();
  invite.tokenHash = Invite.hashToken(token); // the old link stops working
  invite.expiresAt = new Date(Date.now() + Invite.ttlMs);
  await invite.save();
  res.status(200).json({ invite: publicInvite(invite), link: inviteLink(token) });
});

exports.revokeInvite = asyncHandler(async (req, res) => {
  const { workspace } = await loadWorkspaceWithRole(req.params.workspaceId, req.user.id, "admin");
  const invite = await Invite.findOne({ _id: req.params.inviteId, workspace: workspace._id });
  if (!invite) throw notFound("Invitation not found");
  if (!invite.acceptedAt && !invite.revokedAt) {
    invite.revokedAt = new Date();
    await invite.save();
  }
  res.status(200).json({ revoked: true });
});

// ================================================================ invites (for the person invited)

/** Public: lets the landing page say what the invitation is for before anyone has signed in. */
exports.previewInvite = asyncHandler(async (req, res) => {
  const invite = await Invite.findOne({ tokenHash: Invite.hashToken(req.params.token) });
  if (!invite) throw notFound("Invitation not found");
  const [workspace, inviter] = await Promise.all([
    Workspace.findById(invite.workspace).select("name").lean(),
    User.findById(invite.invitedBy).select("firstName lastName").lean(),
  ]);
  if (!workspace) throw notFound("Invitation not found");
  res.status(200).json({ workspaceName: workspace.name, inviterName: fullName(inviter), email: invite.email, role: invite.role, status: invite.status() });
});

async function requireInviteForMe(invite, userId, { needsVerifiedEmail }) {
  const me = await User.findById(userId).select("email emailVerified").lean();
  if (!me || me.email !== invite.email) throw forbidden("This invitation was sent to a different email address");
  if (needsVerifiedEmail && !me.emailVerified) {
    throw forbidden("Use the link from your invitation, or sign in with Google to verify your email");
  }
}

async function joinWorkspace(invite, userId) {
  const workspace = await Workspace.findById(invite.workspace);
  if (!workspace) throw new AppError(410, "This workspace no longer exists");

  if (roleOf(workspace, userId)) {
    // Already in: just retire the invitation instead of failing.
    await Invite.updateOne(pendingFilter({ _id: invite._id }), { acceptedAt: new Date(), acceptedBy: userId });
    return workspace;
  }
  if (invite.status() !== "pending") throw new AppError(410, "This invitation is no longer valid");
  if (workspace.members.length >= MAX_MEMBERS) throw conflict(`This workspace is full (${MAX_MEMBERS} members)`);

  // Claim the invitation atomically so two simultaneous clicks cannot both succeed.
  const claimed = await Invite.findOneAndUpdate(pendingFilter({ _id: invite._id }), { acceptedAt: new Date(), acceptedBy: userId });
  if (!claimed) throw new AppError(410, "This invitation is no longer valid");

  await Workspace.updateOne({ _id: workspace._id, "members.user": { $ne: userId } }, { $push: { members: { user: userId, role: invite.role } } });
  if (String(invite.invitedBy) !== String(userId)) {
    const joiner = await User.findById(userId).select("firstName lastName").lean();
    await Notification.create({ user: invite.invitedBy, type: "workspace.joined", actorName: fullName(joiner), data: { workspaceName: workspace.name, role: invite.role } });
  }
  return workspace;
}

exports.acceptByToken = asyncHandler(async (req, res) => {
  const invite = await Invite.findOne({ tokenHash: Invite.hashToken(req.body.token) });
  if (!invite) throw notFound("Invitation not found");
  await requireInviteForMe(invite, req.user.id, { needsVerifiedEmail: false }); // holding the secret link is the proof
  const workspace = await joinWorkspace(invite, req.user.id);
  res.status(200).json({ workspace: { _id: workspace._id, name: workspace.name } });
});

exports.mine = asyncHandler(async (req, res) => {
  const me = await User.findById(req.user.id).select("email emailVerified").lean();
  if (!me || !me.emailVerified) return res.status(200).json([]); // see acceptByToken: unverified addresses need the link
  const invites = await Invite.find(pendingFilter({ email: me.email })).sort({ createdAt: -1 });
  const [workspaces, inviters] = await Promise.all([
    Workspace.find({ _id: { $in: invites.map((i) => i.workspace) } }).select("name").lean(),
    User.find({ _id: { $in: invites.map((i) => i.invitedBy) } }).select("firstName lastName").lean(),
  ]);
  const wsName = Object.fromEntries(workspaces.map((w) => [String(w._id), w.name]));
  const who = Object.fromEntries(inviters.map((u) => [String(u._id), fullName(u)]));
  res.status(200).json(
    invites
      .filter((i) => wsName[String(i.workspace)])
      .map((i) => ({ ...publicInvite(i), workspaceName: wsName[String(i.workspace)], inviterName: who[String(i.invitedBy)] || "Someone" }))
  );
});

exports.acceptById = asyncHandler(async (req, res) => {
  const invite = await Invite.findById(req.params.inviteId);
  if (!invite) throw notFound("Invitation not found");
  await requireInviteForMe(invite, req.user.id, { needsVerifiedEmail: true });
  const workspace = await joinWorkspace(invite, req.user.id);
  res.status(200).json({ workspace: { _id: workspace._id, name: workspace.name } });
});

exports.declineById = asyncHandler(async (req, res) => {
  const invite = await Invite.findById(req.params.inviteId);
  if (!invite) throw notFound("Invitation not found");
  await requireInviteForMe(invite, req.user.id, { needsVerifiedEmail: true });
  if (invite.status() !== "pending") throw new AppError(410, "This invitation is no longer valid");
  invite.revokedAt = new Date();
  await invite.save();
  res.status(200).json({ declined: true });
});

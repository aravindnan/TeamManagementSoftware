const { prisma } = require("../db/prisma");
const S = require("../db/serialize");
const config = require("../config/env");
const asyncHandler = require("../utils/asyncHandler");
const { AppError, badRequest, forbidden, notFound, conflict } = require("../utils/AppError");
const { RANK, roleOf, loadWorkspace, loadWorkspaceForMember, loadWorkspaceWithRole } = require("../utils/workspaceAccess");
const { removeMemberFromProject } = require("../utils/projectMembers");
const { logActivity, fullName } = require("../utils/activity");
const { INVITE_TTL_MS, hashToken, newToken, inviteStatus, pendingWhere } = require("../utils/invites");

const MAX_OWNED_WORKSPACES = 20;
const MAX_MEMBERS = 100;
const MAX_PENDING_INVITES = 50;

const inviteLink = (token) => `${config.publicClientUrl}/invite/${token}`;
const publicInvite = (inv) => ({
  _id: inv.id, email: inv.email, role: inv.role, createdAt: inv.createdAt, expiresAt: inv.expiresAt, status: inviteStatus(inv),
});

// ================================================================ workspaces

exports.list = asyncHandler(async (req, res) => {
  const workspaces = await prisma.workspace.findMany({
    where: { members: { some: { userId: req.user.id } } },
    include: { members: { select: { userId: true, role: true } } },
    orderBy: [{ name: "asc" }, { id: "asc" }],
  });
  const counts = await prisma.project.groupBy({
    by: ["workspaceId"],
    where: { workspaceId: { in: workspaces.map((w) => w.id) }, members: { some: { userId: req.user.id } } },
    _count: { _all: true },
  });
  const projectCount = Object.fromEntries(counts.map((c) => [c.workspaceId, c._count._all]));
  res.status(200).json(
    workspaces.map((w) => ({
      _id: w.id,
      name: w.name,
      myRole: roleOf(w, req.user.id),
      memberCount: w.members.length,
      projectCount: projectCount[w.id] || 0,
    }))
  );
});

exports.create = asyncHandler(async (req, res) => {
  if ((await prisma.workspace.count({ where: { ownerId: req.user.id } })) >= MAX_OWNED_WORKSPACES) {
    throw conflict(`You can own at most ${MAX_OWNED_WORKSPACES} workspaces`);
  }
  const workspace = await prisma.workspace.create({
    data: { name: req.body.name, ownerId: req.user.id, members: { create: [{ userId: req.user.id, role: "owner" }] } },
  });
  res.status(201).json({ _id: workspace.id, name: workspace.name, myRole: "owner", memberCount: 1, projectCount: 0 });
});

exports.get = asyncHandler(async (req, res) => {
  const { workspace, role } = await loadWorkspaceForMember(req.params.workspaceId, req.user.id);
  const [members, projectCount] = await Promise.all([
    prisma.workspaceMember.findMany({
      where: { workspaceId: workspace.id },
      include: { user: { select: S.PUBLIC_USER_SELECT } },
      orderBy: [{ joinedAt: "asc" }, { userId: "asc" }],
    }),
    prisma.project.count({ where: { workspaceId: workspace.id, members: { some: { userId: req.user.id } } } }),
  ]);
  res.status(200).json({
    _id: workspace.id,
    name: workspace.name,
    owner: workspace.ownerId,
    myRole: role,
    projectCount,
    members: members.map((m) => ({ user: S.userPublic(m.user), role: m.role, joinedAt: m.joinedAt })),
  });
});

exports.rename = asyncHandler(async (req, res) => {
  const { workspace } = await loadWorkspaceWithRole(req.params.workspaceId, req.user.id, "admin");
  const updated = await prisma.workspace.update({ where: { id: workspace.id }, data: { name: req.body.name } });
  res.status(200).json({ _id: updated.id, name: updated.name });
});

exports.remove = asyncHandler(async (req, res) => {
  const { workspace } = await loadWorkspaceWithRole(req.params.workspaceId, req.user.id, "owner");
  const projects = await prisma.project.count({ where: { workspaceId: workspace.id } });
  if (projects > 0) throw conflict(`This workspace still has ${projects} project${projects === 1 ? "" : "s"}. Delete or move them first.`);
  await prisma.workspace.delete({ where: { id: workspace.id } }); // members and invitations cascade
  res.status(200).json({ deleted: true });
});

// ================================================================ members

exports.setRole = asyncHandler(async (req, res) => {
  const { workspace } = await loadWorkspaceWithRole(req.params.workspaceId, req.user.id, "owner");
  const targetRole = roleOf(workspace, req.params.userId);
  if (!targetRole) throw notFound("That person is not in this workspace");
  if (targetRole === "owner") throw conflict("The owner's role cannot be changed. Transfer ownership instead.");
  await prisma.workspaceMember.update({
    where: { workspaceId_userId: { workspaceId: workspace.id, userId: req.params.userId } },
    data: { role: req.body.role },
  });
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

  const leaver = await prisma.user.findUnique({ where: { id: userId }, select: { firstName: true, lastName: true } });
  const ownerId = workspace.ownerId;

  // Take them off every project in the workspace. Projects they managed pass to the workspace owner,
  // and their tasks go to whoever manages the project, so nothing is left orphaned. One transaction:
  // either the whole removal happens or none of it.
  const affected = await prisma.$transaction(async (tx) => {
    const projects = await tx.project.findMany({
      where: { workspaceId: workspace.id, OR: [{ members: { some: { userId } } }, { projectManagerId: userId }] },
      select: { id: true, projectManagerId: true },
      orderBy: { id: "asc" },
    });
    const results = [];
    for (const project of projects) {
      let manager = project.projectManagerId;
      if (manager === userId) {
        await tx.project.update({ where: { id: project.id }, data: { projectManagerId: ownerId } });
        await tx.projectMember.createMany({ data: [{ projectId: project.id, userId: ownerId }], skipDuplicates: true });
        manager = ownerId;
      }
      const reassigned = await removeMemberFromProject({ _id: project.id, projectManager: manager }, userId, tx);
      results.push({ projectId: project.id, reassigned });
    }
    await tx.workspaceMember.delete({ where: { workspaceId_userId: { workspaceId: workspace.id, userId } } });
    return results;
  });

  for (const { projectId, reassigned } of affected) {
    await logActivity(req.user.id, projectId, "member.removed", { data: { memberName: fullName(leaver), reassigned } });
  }
  res.status(200).json({ removed: true, projectsAffected: affected.length });
});

exports.transferOwnership = asyncHandler(async (req, res) => {
  const { workspace } = await loadWorkspaceWithRole(req.params.workspaceId, req.user.id, "owner");
  const target = req.body.userId;
  if (target === req.user.id) throw badRequest("You already own this workspace");
  if (!roleOf(workspace, target)) throw badRequest("The new owner must already be in the workspace");
  await prisma.$transaction([
    prisma.workspace.update({ where: { id: workspace.id }, data: { ownerId: target } }),
    prisma.workspaceMember.update({ where: { workspaceId_userId: { workspaceId: workspace.id, userId: target } }, data: { role: "owner" } }),
    prisma.workspaceMember.update({ where: { workspaceId_userId: { workspaceId: workspace.id, userId: req.user.id } }, data: { role: "admin" } }),
  ]);
  res.status(200).json({ owner: target });
});

// ================================================================ invites (managed by admins)

async function notifyIfKnown(email, workspace, role, inviteId, inviterName) {
  // Only people whose email we have verified see invitations addressed to that email in the app. For an
  // unverified password account anyone could have typed that address, so they need the secret link.
  const user = await prisma.user.findFirst({ where: { email, emailVerified: true }, select: { id: true } });
  if (!user) return;
  await prisma.notification.create({
    data: { userId: user.id, type: "workspace.invited", actorName: inviterName, data: { workspaceName: workspace.name, role, inviteId: String(inviteId) } },
  });
}

exports.createInvite = asyncHandler(async (req, res) => {
  const { workspace, role: myRole } = await loadWorkspaceWithRole(req.params.workspaceId, req.user.id, "admin");
  const { email, role } = req.body;
  if (role === "admin" && myRole !== "owner") throw forbidden("Only the owner can invite someone as an admin");
  if (workspace.members.length >= MAX_MEMBERS) throw conflict(`A workspace can have at most ${MAX_MEMBERS} members`);

  const existing = await prisma.user.findUnique({ where: { email }, select: { id: true } });
  if (existing && roleOf(workspace, existing.id)) throw conflict("That person is already in this workspace");
  if ((await prisma.invite.count({ where: pendingWhere({ workspaceId: workspace.id }) })) >= MAX_PENDING_INVITES) {
    throw conflict(`There are already ${MAX_PENDING_INVITES} pending invitations. Revoke some first.`);
  }

  // One live invitation per address: a new one replaces the old.
  const token = newToken();
  const invite = await prisma.$transaction(async (tx) => {
    await tx.invite.updateMany({ where: { workspaceId: workspace.id, email, acceptedAt: null, revokedAt: null }, data: { revokedAt: new Date() } });
    return tx.invite.create({
      data: { workspaceId: workspace.id, email, role, tokenHash: hashToken(token), invitedById: req.user.id, expiresAt: new Date(Date.now() + INVITE_TTL_MS) },
    });
  });
  const inviter = await prisma.user.findUnique({ where: { id: req.user.id }, select: { firstName: true, lastName: true } });
  await notifyIfKnown(email, workspace, role, invite.id, fullName(inviter));

  // The link is only ever returned here and on regenerate: the database holds just its hash.
  res.status(201).json({ invite: publicInvite(invite), link: inviteLink(token) });
});

exports.listInvites = asyncHandler(async (req, res) => {
  const { workspace } = await loadWorkspaceWithRole(req.params.workspaceId, req.user.id, "admin");
  const invites = await prisma.invite.findMany({ where: pendingWhere({ workspaceId: workspace.id }), orderBy: [{ createdAt: "desc" }, { id: "desc" }] });
  res.status(200).json(invites.map(publicInvite));
});

exports.regenerateInvite = asyncHandler(async (req, res) => {
  const { workspace, role: myRole } = await loadWorkspaceWithRole(req.params.workspaceId, req.user.id, "admin");
  const invite = await prisma.invite.findFirst({ where: { id: req.params.inviteId, workspaceId: workspace.id } });
  if (!invite) throw notFound("Invitation not found");
  if (invite.acceptedAt || invite.revokedAt) throw new AppError(410, "This invitation is no longer valid");
  if (invite.role === "admin" && myRole !== "owner") throw forbidden("Only the owner can manage admin invitations");
  const token = newToken();
  const updated = await prisma.invite.update({
    where: { id: invite.id },
    // the old link stops working
    data: { tokenHash: hashToken(token), expiresAt: new Date(Date.now() + INVITE_TTL_MS) },
  });
  res.status(200).json({ invite: publicInvite(updated), link: inviteLink(token) });
});

exports.revokeInvite = asyncHandler(async (req, res) => {
  const { workspace } = await loadWorkspaceWithRole(req.params.workspaceId, req.user.id, "admin");
  const invite = await prisma.invite.findFirst({ where: { id: req.params.inviteId, workspaceId: workspace.id } });
  if (!invite) throw notFound("Invitation not found");
  if (!invite.acceptedAt && !invite.revokedAt) {
    await prisma.invite.update({ where: { id: invite.id }, data: { revokedAt: new Date() } });
  }
  res.status(200).json({ revoked: true });
});

// ================================================================ invites (for the person invited)

/** Public: lets the landing page say what the invitation is for before anyone has signed in. */
exports.previewInvite = asyncHandler(async (req, res) => {
  const invite = await prisma.invite.findUnique({
    where: { tokenHash: hashToken(req.params.token) },
    include: { workspace: { select: { name: true } }, invitedBy: { select: { firstName: true, lastName: true } } },
  });
  if (!invite) throw notFound("Invitation not found");
  res.status(200).json({
    workspaceName: invite.workspace.name, inviterName: fullName(invite.invitedBy), email: invite.email, role: invite.role, status: inviteStatus(invite),
  });
});

async function requireInviteForMe(invite, userId, { needsVerifiedEmail }) {
  const me = await prisma.user.findUnique({ where: { id: userId }, select: { email: true, emailVerified: true } });
  if (!me || me.email !== invite.email) throw forbidden("This invitation was sent to a different email address");
  if (needsVerifiedEmail && !me.emailVerified) {
    throw forbidden("Use the link from your invitation, or sign in with Google to verify your email");
  }
}

async function joinWorkspace(invite, userId) {
  const workspace = await loadWorkspace(invite.workspaceId);
  if (!workspace) throw new AppError(410, "This workspace no longer exists");

  if (roleOf(workspace, userId)) {
    // Already in: just retire the invitation instead of failing.
    await prisma.invite.updateMany({ where: pendingWhere({ id: invite.id }), data: { acceptedAt: new Date(), acceptedById: userId } });
    return workspace;
  }
  if (inviteStatus(invite) !== "pending") throw new AppError(410, "This invitation is no longer valid");
  if (workspace.members.length >= MAX_MEMBERS) throw conflict(`This workspace is full (${MAX_MEMBERS} members)`);

  // Claim the invitation atomically so two simultaneous clicks cannot both succeed: the conditional UPDATE
  // matches a still-pending row for exactly one of them. Claim and membership commit together or not at all.
  await prisma.$transaction(async (tx) => {
    const claimed = await tx.invite.updateMany({ where: pendingWhere({ id: invite.id }), data: { acceptedAt: new Date(), acceptedById: userId } });
    if (claimed.count !== 1) throw new AppError(410, "This invitation is no longer valid");
    await tx.workspaceMember.createMany({ data: [{ workspaceId: workspace.id, userId, role: invite.role }], skipDuplicates: true });
  });

  if (invite.invitedById && invite.invitedById !== userId) {
    const joiner = await prisma.user.findUnique({ where: { id: userId }, select: { firstName: true, lastName: true } });
    await prisma.notification.create({
      data: { userId: invite.invitedById, type: "workspace.joined", actorName: fullName(joiner), data: { workspaceName: workspace.name, role: invite.role } },
    });
  }
  return workspace;
}

exports.acceptByToken = asyncHandler(async (req, res) => {
  const invite = await prisma.invite.findUnique({ where: { tokenHash: hashToken(req.body.token) } });
  if (!invite) throw notFound("Invitation not found");
  await requireInviteForMe(invite, req.user.id, { needsVerifiedEmail: false }); // holding the secret link is the proof
  const workspace = await joinWorkspace(invite, req.user.id);
  res.status(200).json({ workspace: { _id: workspace.id, name: workspace.name } });
});

exports.mine = asyncHandler(async (req, res) => {
  const me = await prisma.user.findUnique({ where: { id: req.user.id }, select: { email: true, emailVerified: true } });
  if (!me || !me.emailVerified) return res.status(200).json([]); // see acceptByToken: unverified addresses need the link
  const invites = await prisma.invite.findMany({
    where: pendingWhere({ email: me.email }),
    include: { workspace: { select: { name: true } }, invitedBy: { select: { firstName: true, lastName: true } } },
    orderBy: [{ createdAt: "desc" }, { id: "desc" }],
  });
  res.status(200).json(
    invites.map((i) => ({ ...publicInvite(i), workspaceName: i.workspace.name, inviterName: i.invitedBy ? fullName(i.invitedBy) : "Someone" }))
  );
});

exports.acceptById = asyncHandler(async (req, res) => {
  const invite = await prisma.invite.findUnique({ where: { id: req.params.inviteId } });
  if (!invite) throw notFound("Invitation not found");
  await requireInviteForMe(invite, req.user.id, { needsVerifiedEmail: true });
  const workspace = await joinWorkspace(invite, req.user.id);
  res.status(200).json({ workspace: { _id: workspace.id, name: workspace.name } });
});

exports.declineById = asyncHandler(async (req, res) => {
  const invite = await prisma.invite.findUnique({ where: { id: req.params.inviteId } });
  if (!invite) throw notFound("Invitation not found");
  await requireInviteForMe(invite, req.user.id, { needsVerifiedEmail: true });
  if (inviteStatus(invite) !== "pending") throw new AppError(410, "This invitation is no longer valid");
  await prisma.invite.update({ where: { id: invite.id }, data: { revokedAt: new Date() } });
  res.status(200).json({ declined: true });
});

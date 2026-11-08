const { prisma } = require("../db/prisma");
const { notFound, forbidden } = require("./AppError");

const RANK = { member: 1, admin: 2, owner: 3 };

/** Role of `userId` in a workspace loaded with its `members` rows, or null. */
const roleOf = (workspace, userId) => {
  const m = workspace.members.find((x) => String(x.userId) === String(userId));
  return m ? m.role : null;
};

const loadWorkspace = (workspaceId, db = prisma) =>
  db.workspace.findUnique({ where: { id: workspaceId }, include: { members: { orderBy: [{ joinedAt: "asc" }, { userId: "asc" }] } } });

/**
 * Loads a workspace the caller belongs to. Non-members get a 404 (not a 403) so the existence of
 * workspaces they are not part of is not revealed.
 */
async function loadWorkspaceForMember(workspaceId, userId) {
  const workspace = await loadWorkspace(workspaceId);
  const role = workspace && roleOf(workspace, userId);
  if (!workspace || !role) throw notFound("Workspace not found");
  return { workspace, role };
}

/** Same, but the caller must hold at least `minimum` ("admin" or "owner"). */
async function loadWorkspaceWithRole(workspaceId, userId, minimum) {
  const loaded = await loadWorkspaceForMember(workspaceId, userId);
  if (RANK[loaded.role] < RANK[minimum]) {
    throw forbidden(minimum === "owner" ? "Only the workspace owner can do that" : "Only workspace admins can do that");
  }
  return loaded;
}

module.exports = { RANK, roleOf, loadWorkspace, loadWorkspaceForMember, loadWorkspaceWithRole };

const { prisma } = require("../db/prisma");

/**
 * Brings projects created before workspaces existed into the new model. For each project manager with such projects,
 * a workspace "<First name>'s workspace" is created (or reused) with them as owner; everyone on those projects joins
 * it as a member; the projects are linked to it.
 *
 * Safe to run repeatedly: projects that already belong to a workspace are never touched, and an existing migrated
 * workspace is reused instead of duplicated.
 */
async function migrateLegacyProjects() {
  const legacy = await prisma.project.findMany({
    where: { workspaceId: null },
    select: { id: true, projectManagerId: true, members: { select: { userId: true } } },
    orderBy: { id: "asc" },
  });
  const byManager = new Map();
  for (const project of legacy) {
    if (!byManager.has(project.projectManagerId)) byManager.set(project.projectManagerId, []);
    byManager.get(project.projectManagerId).push(project);
  }

  const summary = { workspacesCreated: 0, projectsMigrated: 0, membersAdded: 0 };
  for (const [managerId, projects] of byManager) {
    // One transaction per manager: either their workspace is fully set up and linked, or nothing changed.
    await prisma.$transaction(async (tx) => {
      const manager = await tx.user.findUnique({ where: { id: managerId }, select: { firstName: true } });
      if (!manager) return; // cannot happen with foreign keys, but never guess

      const name = `${manager.firstName}'s workspace`.slice(0, 60);
      let workspace = await tx.workspace.findFirst({ where: { ownerId: managerId, name }, include: { members: true } });
      if (!workspace) {
        workspace = await tx.workspace.create({
          data: { name, ownerId: managerId, members: { create: [{ userId: managerId, role: "owner" }] } },
          include: { members: true },
        });
        summary.workspacesCreated += 1;
      }

      const known = new Set(workspace.members.map((m) => m.userId));
      const toAdd = [];
      for (const project of projects) {
        for (const { userId } of project.members) {
          if (known.has(userId)) continue;
          known.add(userId);
          toAdd.push({ workspaceId: workspace.id, userId, role: "member" });
        }
      }
      if (toAdd.length) await tx.workspaceMember.createMany({ data: toAdd });
      summary.membersAdded += toAdd.length;

      await tx.project.updateMany({ where: { id: { in: projects.map((p) => p.id) } }, data: { workspaceId: workspace.id } });
      summary.projectsMigrated += projects.length;
    });
  }
  return summary;
}

module.exports = { migrateLegacyProjects };

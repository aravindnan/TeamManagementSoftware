const { prisma } = require("../db/prisma");

/**
 * Takes a member off a project. Their tasks in it are handed to the project manager so nothing is orphaned.
 * Returns how many tasks were handed over. (The caller checks permissions and that they are not the manager.)
 * Pass a transaction client as `db` to make this part of a larger atomic change.
 */
async function removeMemberFromProject(project, memberId, db) {
  if (!db) return prisma.$transaction((tx) => removeMemberFromProject(project, memberId, tx));
  const { count } = await db.task.updateMany({
    where: { projectId: project._id, assignedToId: memberId },
    data: { assignedToId: project.projectManager },
  });
  await db.projectMember.deleteMany({ where: { projectId: project._id, userId: memberId } });
  return count;
}

module.exports = { removeMemberFromProject };

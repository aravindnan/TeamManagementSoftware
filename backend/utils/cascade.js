const { prisma } = require("../db/prisma");

// Tasks own their comments, files and sub-tasks through foreign keys with ON DELETE CASCADE, so
// deleting the task rows is all it takes. Kept as a function so callers can run it in a transaction.
async function deleteTasksCascade(taskIds, db = prisma) {
  if (!taskIds || taskIds.length === 0) return;
  await db.task.deleteMany({ where: { id: { in: taskIds } } });
}

module.exports = { deleteTasksCascade };

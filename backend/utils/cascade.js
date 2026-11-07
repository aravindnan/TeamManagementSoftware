const Task = require("../model/task");
const User = require("../model/user");
const Comment = require("../model/comment");

// Deletes tasks together with their comments and every back-reference held by users.
async function deleteTasksCascade(taskIds) {
  if (!taskIds || taskIds.length === 0) return;
  const tasks = await Task.find({ _id: { $in: taskIds } }).select("assignedTo taskComments");
  const commentIds = tasks.flatMap((t) => t.taskComments);
  const assignees = [...new Set(tasks.map((t) => String(t.assignedTo)))];

  await Promise.all([
    Comment.deleteMany({ _id: { $in: commentIds } }),
    User.updateMany({ _id: { $in: assignees } }, { $pullAll: { allTasks: taskIds } }),
    Task.deleteMany({ _id: { $in: taskIds } }),
  ]);
}

module.exports = { deleteTasksCascade };

const User = require("../model/user");
const Task = require("../model/task");
const Project = require("../model/project");
const asyncHandler = require("../utils/asyncHandler");
const { notFound, forbidden, conflict } = require("../utils/AppError");
const { PUBLIC_USER_FIELDS } = require("../utils/access");
const { deleteTasksCascade } = require("../utils/cascade");
const { logActivity } = require("../utils/activity");

const getFullProfile = (userId) =>
  User.findById(userId).populate("myProjects").populate("involvedProjects").populate("allTasks");

const requireSelf = (req) => {
  if (req.params.userId !== req.user.id) throw forbidden("You can only access your own account");
};

exports.getFullProfile = getFullProfile;

// Directory used by the "add member" picker. Public fields only, capped.
exports.get_all_users = asyncHandler(async (req, res) => {
  const { q } = req.query;
  const filter = {};
  if (q) {
    const rx = new RegExp(q.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"), "i");
    filter.$or = [{ firstName: rx }, { lastName: rx }, { username: rx }, { email: rx }];
  }
  const users = await User.find(filter).select(PUBLIC_USER_FIELDS).sort({ firstName: 1 }).limit(200);
  res.status(200).json(users);
});

exports.get_user_by_id = asyncHandler(async (req, res) => {
  if (req.params.userId === req.user.id) {
    const me = await getFullProfile(req.user.id);
    if (!me) throw notFound("User not found");
    return res.status(200).json(me);
  }
  const other = await User.findById(req.params.userId).select(PUBLIC_USER_FIELDS);
  if (!other) throw notFound("User not found");
  res.status(200).json(other);
});

exports.get_all_my_projects_by_user_id = asyncHandler(async (req, res) => {
  requireSelf(req);
  res.status(200).json(await Project.find({ projectManager: req.user.id }));
});

exports.get_all_involved_projects_by_user_id = asyncHandler(async (req, res) => {
  requireSelf(req);
  res.status(200).json(
    await Project.find({ projectMembers: req.user.id, projectManager: { $ne: req.user.id } })
  );
});

exports.get_all_tasks_by_user_id = asyncHandler(async (req, res) => {
  requireSelf(req);
  res.status(200).json(await Task.find({ assignedTo: req.user.id }));
});

exports.create_new_project_for_user_id = asyncHandler(async (req, res) => {
  requireSelf(req);
  const { projectName, projectDescription } = req.body;
  const project = await Project.create({
    projectName,
    projectDescription,
    projectManager: req.user.id,
    projectMembers: [req.user.id],
  });
  await User.updateOne({ _id: req.user.id }, { $addToSet: { myProjects: project._id } });
  await logActivity(req.user.id, project._id, "project.created", { data: { name: projectName } });
  res.status(201).json({ message: "Project created successfully", project });
});

exports.update_user_profile_by_user_id = asyncHandler(async (req, res) => {
  requireSelf(req);
  const { firstName, lastName, email, username, dateOfBirth, bio } = req.body;
  const user = await User.findById(req.user.id);
  if (!user) throw notFound("User not found");
  Object.assign(user, { firstName, email, username });
  if (lastName !== undefined) user.lastName = lastName;
  if (dateOfBirth !== undefined) user.dateOfBirth = dateOfBirth;
  if (bio !== undefined) user.bio = bio;
  await user.save(); // duplicate username/email surfaces as 409 via the error middleware
  res.status(200).json({ message: "User updated successfully", updateStatus: true });
});

exports.delete_user_by_user_id = asyncHandler(async (req, res) => {
  requireSelf(req);
  if (await Project.exists({ projectManager: req.user.id })) {
    throw conflict("Delete or hand over the projects you manage before deleting your account");
  }
  const tasks = await Task.find({ assignedTo: req.user.id }).select("_id project");
  await Project.updateMany({ projectMembers: req.user.id }, { $pull: { projectMembers: req.user.id } });
  await Project.updateMany({ allTasks: { $in: tasks.map((t) => t._id) } }, { $pullAll: { allTasks: tasks.map((t) => t._id) } });
  await deleteTasksCascade(tasks.map((t) => t._id));
  await User.deleteOne({ _id: req.user.id });
  res.clearCookie(require("../config/env").cookieName);
  res.status(200).json({ message: "User deleted successfully" });
});

const { prisma } = require("../db/prisma");
const S = require("../db/serialize");
const { getFullProfile, listProjects, listTasks, getProject } = require("../db/queries");
const asyncHandler = require("../utils/asyncHandler");
const { notFound, forbidden, conflict } = require("../utils/AppError");
const { logActivity } = require("../utils/activity");
const config = require("../config/env");

const requireSelf = (req) => {
  if (req.params.userId !== req.user.id) throw forbidden("You can only access your own account");
};

exports.getFullProfile = getFullProfile;

// Directory used by the "add member" picker. Public fields only, capped.
exports.get_all_users = asyncHandler(async (req, res) => {
  const { q } = req.query;
  const me = req.user.id;
  // Only people you actually share a workspace or a project with: this is not a directory of every account.
  const AND = [
    {
      OR: [
        { workspaceMembers: { some: { workspace: { members: { some: { userId: me } } } } } },
        { projectMembers: { some: { project: { members: { some: { userId: me } } } } } },
      ],
    },
  ];
  if (q) {
    const has = { contains: q, mode: "insensitive" };
    AND.push({ OR: [{ firstName: has }, { lastName: has }, { username: has }, { email: has }] });
  }
  const users = await prisma.user.findMany({
    where: { AND },
    select: S.PUBLIC_USER_SELECT,
    orderBy: [{ firstName: "asc" }, { id: "asc" }],
    take: 200,
  });
  res.status(200).json(users.map(S.userPublic));
});

exports.get_user_by_id = asyncHandler(async (req, res) => {
  if (req.params.userId === req.user.id) {
    const me = await getFullProfile(req.user.id);
    if (!me) throw notFound("User not found");
    return res.status(200).json(me);
  }
  const other = await prisma.user.findUnique({ where: { id: req.params.userId }, select: S.PUBLIC_USER_SELECT });
  if (!other) throw notFound("User not found");
  res.status(200).json(S.userPublic(other));
});

exports.get_all_my_projects_by_user_id = asyncHandler(async (req, res) => {
  requireSelf(req);
  res.status(200).json(await listProjects({ projectManagerId: req.user.id }));
});

exports.get_all_involved_projects_by_user_id = asyncHandler(async (req, res) => {
  requireSelf(req);
  res.status(200).json(await listProjects({ members: { some: { userId: req.user.id } }, NOT: { projectManagerId: req.user.id } }));
});

exports.get_all_tasks_by_user_id = asyncHandler(async (req, res) => {
  requireSelf(req);
  res.status(200).json(await listTasks({ assignedToId: req.user.id }));
});

exports.create_new_project_for_user_id = asyncHandler(async (req, res) => {
  requireSelf(req);
  const { projectName, projectDescription, workspaceId } = req.body;
  if (workspaceId && !(await prisma.workspaceMember.findUnique({ where: { workspaceId_userId: { workspaceId, userId: req.user.id } } }))) {
    throw forbidden("You are not a member of that workspace");
  }
  const created = await prisma.project.create({
    data: {
      workspaceId,
      projectName,
      projectDescription,
      projectManagerId: req.user.id,
      members: { create: [{ userId: req.user.id }] },
    },
  });
  await logActivity(req.user.id, created.id, "project.created", { data: { name: projectName } });
  res.status(201).json({ message: "Project created successfully", project: await getProject(created.id) });
});

exports.update_user_profile_by_user_id = asyncHandler(async (req, res) => {
  requireSelf(req);
  const { firstName, lastName, email, username, dateOfBirth, bio } = req.body;
  if (!(await prisma.user.findUnique({ where: { id: req.user.id }, select: { id: true } }))) throw notFound("User not found");
  const data = { firstName, email, username };
  if (lastName !== undefined) data.lastName = lastName;
  if (dateOfBirth !== undefined) data.dateOfBirth = dateOfBirth;
  if (bio !== undefined) data.bio = bio;
  await prisma.user.update({ where: { id: req.user.id }, data }); // duplicate username/email surfaces as 409 via the error middleware
  res.status(200).json({ message: "User updated successfully", updateStatus: true });
});

exports.delete_user_by_user_id = asyncHandler(async (req, res) => {
  requireSelf(req);
  const me = req.user.id;
  // All or nothing: a refusal must not leave the person half removed from their workspaces.
  await prisma.$transaction(async (tx) => {
    if (await tx.workspace.findFirst({ where: { ownerId: me }, select: { id: true } })) {
      throw conflict("Transfer ownership of your workspaces or delete them before deleting your account");
    }
    if (await tx.project.findFirst({ where: { projectManagerId: me }, select: { id: true } })) {
      throw conflict("Delete or hand over the projects you manage before deleting your account");
    }
    // Tasks assigned to them go (with their comments, files and sub-tasks). Everything else that points at
    // the account (memberships, notifications) goes through ON DELETE CASCADE; authorship fields are cleared.
    await tx.task.deleteMany({ where: { assignedToId: me } });
    await tx.user.delete({ where: { id: me } });
  });
  res.clearCookie(config.cookieName);
  res.status(200).json({ message: "User deleted successfully" });
});

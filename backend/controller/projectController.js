const { prisma } = require("../db/prisma");
const S = require("../db/serialize");
const { getProject, listProjects, listTasks, getProjectPopulated } = require("../db/queries");
const asyncHandler = require("../utils/asyncHandler");
const { notFound, badRequest, forbidden } = require("../utils/AppError");
const { idEq, isManager, isMember, loadProject, requireMember, requireManager } = require("../utils/access");
const { assessProject } = require("../utils/risk");
const { removeMemberFromProject } = require("../utils/projectMembers");
const { computeAnalytics } = require("../utils/analytics");
const { logActivity, fullName, excerpt } = require("../utils/activity");

const touchProject = (id) => prisma.project.update({ where: { id }, data: { updatedAt: new Date() } });

// ----- GET -----
exports.get_all_projects = asyncHandler(async (req, res) => {
  res.status(200).json(
    await listProjects({ members: { some: { userId: req.user.id } } }, prisma, [{ createdAt: "desc" }, { id: "desc" }])
  );
});

exports.get_project_by_id = asyncHandler(async (req, res) => {
  const project = await getProjectPopulated(req.params.projectId);
  if (!project) throw notFound("Project not found");
  requireMember(project, req.user.id);
  res.status(200).json(project);
});

exports.get_project_members_by_id = asyncHandler(async (req, res) => {
  const project = await loadProject(req.params.projectId);
  requireMember(project, req.user.id);
  const rows = await prisma.projectMember.findMany({
    where: { projectId: project._id },
    include: { user: { select: S.PUBLIC_USER_SELECT } },
    orderBy: [{ addedAt: "asc" }, { userId: "asc" }],
  });
  res.status(200).json(rows.map((r) => S.userPublic(r.user)));
});

exports.get_all_tasks_by_project_id = asyncHandler(async (req, res) => {
  const project = await loadProject(req.params.projectId);
  requireMember(project, req.user.id);
  res.status(200).json(await listTasks({ projectId: project._id }));
});

exports.get_project_overall_performance_by_id = asyncHandler(async (req, res) => {
  const project = await loadProject(req.params.projectId);
  requireMember(project, req.user.id);
  const [total, completed] = await Promise.all([
    prisma.task.count({ where: { projectId: project._id } }),
    prisma.task.count({ where: { projectId: project._id, taskStatus: "Completed" } }),
  ]);
  const overallPerformance = total === 0 ? 0 : Math.round((completed / total) * 100);
  res.status(200).json({ overallPerformance, totalTasks: total, completedTasks: completed });
});

exports.get_project_activity_by_id = asyncHandler(async (req, res) => {
  const project = await loadProject(req.params.projectId);
  requireMember(project, req.user.id);
  const { before, category, limit, task } = req.query;

  const where = { projectId: project._id };
  if (category) where.category = category;
  if (task) where.taskId = task;
  if (before) where.id = { lt: before }; // cursor = id of the last item already shown

  const rows = await prisma.activity.findMany({ where, orderBy: { id: "desc" }, take: limit + 1 });
  const hasMore = rows.length > limit;
  const items = hasMore ? rows.slice(0, limit) : rows;
  res.status(200).json({ items: items.map(S.activity), nextCursor: hasMore ? items[items.length - 1].id : null });
});

exports.get_project_analytics_by_id = asyncHandler(async (req, res) => {
  const project = await loadProject(req.params.projectId);
  requireMember(project, req.user.id);

  const [tasks, lastMoves] = await Promise.all([
    listTasks({ projectId: project._id }),
    // when each task last changed column, from the activity log: the newest entry per task
    prisma.$queryRaw`
      SELECT DISTINCT ON ("taskId") "taskId", "createdAt" AS at
      FROM "Activity"
      WHERE "projectId" = ${project._id} AND verb = 'task.status_changed' AND "taskId" IS NOT NULL
      ORDER BY "taskId", id DESC`,
  ]);
  const statusChangedAt = Object.fromEntries(lastMoves.map((m) => [m.taskId, new Date(m.at).getTime()]));
  const analytics = computeAnalytics(tasks, statusChangedAt);

  // Per-person figures are the manager's view; everyone else only sees their own row.
  const manager = isManager(project, req.user.id);
  if (!manager) analytics.byAssignee = analytics.byAssignee.filter((p) => p.assignedTo === req.user.id);
  res.status(200).json({ ...analytics, scope: manager ? "all" : "self" });
});

exports.get_project_risk_by_id = asyncHandler(async (req, res) => {
  const project = await loadProject(req.params.projectId);
  requireMember(project, req.user.id);
  const tasks = await listTasks({ projectId: project._id });
  res.status(200).json(assessProject(tasks));
});

// ----- POST -----
exports.add_new_task_to_project_by_id = asyncHandler(async (req, res) => {
  const project = await loadProject(req.params.projectId);
  requireManager(project, req.user.id);
  const { taskTitle, taskDescription, taskPriority, dueDate, assignedTo } = req.body;

  // Validate everything before writing anything.
  if (!isMember(project, assignedTo)) throw badRequest("Assignee must be a member of the project");

  const task = await prisma.task.create({
    data: {
      taskTitle,
      taskDescription,
      taskPriority,
      dueDate,
      assignedOn: new Date().toISOString(),
      projectId: project._id,
      assignedById: req.user.id,
      assignedToId: assignedTo,
    },
  });
  const assignee = await prisma.user.findUnique({ where: { id: assignedTo }, select: { firstName: true, lastName: true } });
  await logActivity(req.user.id, project._id, "task.created", {
    task: task.id,
    data: { title: taskTitle, priority: taskPriority, dueDate, assigneeName: fullName(assignee) },
    notify: [assignedTo],
  });
  res.status(201).json({ message: "New task added to the project successfully", taskId: task.id, status: true });
});

exports.add_member_to_project_by_id = asyncHandler(async (req, res) => {
  const project = await loadProject(req.params.projectId);
  requireManager(project, req.user.id);
  const { memberId } = req.body;

  const newMember = await prisma.user.findUnique({ where: { id: memberId }, select: { firstName: true, lastName: true } });
  if (!newMember) throw notFound("User not found");
  if (isMember(project, memberId)) throw badRequest("User is already a member of the project");
  // Projects inside a workspace can only include people from that workspace.
  if (
    project.workspace &&
    !(await prisma.workspaceMember.findUnique({ where: { workspaceId_userId: { workspaceId: project.workspace, userId: memberId } } }))
  ) {
    throw badRequest("Add this person to the workspace first (invite them from the Workspaces panel)");
  }

  await prisma.projectMember.createMany({ data: [{ projectId: project._id, userId: memberId }], skipDuplicates: true });
  await touchProject(project._id);
  await logActivity(req.user.id, project._id, "member.added", { data: { memberName: fullName(newMember) }, notify: [memberId] });
  res.status(200).json({ message: "Member added to the project successfully", project: await getProject(project._id) });
});

exports.add_new_media_to_project = asyncHandler(async (req, res) => {
  const project = await loadProject(req.params.projectId);
  requireMember(project, req.user.id);
  const items = req.body.mediaDataArray.map((m) => ({ ...m, uploadedBy: req.user.id }));
  await prisma.media.createMany({ data: items.map((m) => ({ ...m, projectId: project._id })) });
  await touchProject(project._id);
  await logActivity(req.user.id, project._id, "media.added", { data: { names: items.map((m) => m.mediaName || "file"), scope: "project" } });
  res.status(200).json({ message: "Media added to project", addSuccess: true });
});

exports.add_comment_by_project_id = asyncHandler(async (req, res) => {
  const project = await loadProject(req.params.projectId);
  requireMember(project, req.user.id);
  const sender = await prisma.user.findUnique({ where: { id: req.user.id }, select: { firstName: true, lastName: true } });
  const comment = await prisma.comment.create({
    data: {
      senderName: `${sender.firstName} ${sender.lastName}`.trim(),
      senderId: req.user.id,
      messageContent: req.body.messageContent,
      projectId: project._id,
    },
  });
  await touchProject(project._id);
  await logActivity(req.user.id, project._id, "comment.project", { data: { excerpt: excerpt(comment.messageContent) } });
  res.status(200).json({ message: "Comment added successfully", comment: S.comment(comment), addStatus: true });
});

// ----- PUT -----
exports.edit_project_by_id = asyncHandler(async (req, res) => {
  const project = await loadProject(req.params.projectId);
  requireManager(project, req.user.id);
  const { projectName, projectDescription, projectStatus } = req.body;
  const before = { projectName: project.projectName, projectDescription: project.projectDescription, projectStatus: project.projectStatus };
  await prisma.project.update({ where: { id: project._id }, data: { projectName, projectDescription, projectStatus } });
  const changes = [];
  if (before.projectName !== projectName) changes.push({ field: "name", from: before.projectName, to: projectName });
  if (before.projectStatus !== projectStatus) changes.push({ field: "status", from: before.projectStatus, to: projectStatus });
  if ((before.projectDescription || "") !== (projectDescription || "")) changes.push({ field: "description" });
  if (changes.length) await logActivity(req.user.id, project._id, "project.updated", { data: { changes } });
  res.status(200).json({ message: "Project updated successfully", status: true });
});

// ----- DELETE -----
exports.remove_member_from_project_by_id = asyncHandler(async (req, res) => {
  const project = await loadProject(req.params.projectId);
  requireManager(project, req.user.id);
  const { memberId } = req.body;

  const leaver = await prisma.user.findUnique({ where: { id: memberId }, select: { firstName: true, lastName: true } });
  if (isManager(project, memberId)) throw badRequest("The project manager cannot be removed");
  if (!isMember(project, memberId)) throw badRequest("User is not a member of the project");

  const reassigned = await removeMemberFromProject(project, memberId);
  await logActivity(req.user.id, project._id, "member.removed", {
    data: { memberName: fullName(leaver), reassigned },
    notify: [memberId],
  });
  res.status(200).json({ message: "Member removed from the project successfully", deleteStatus: true });
});

exports.delete_project_by_id = asyncHandler(async (req, res) => {
  const project = await loadProject(req.params.projectId);
  requireManager(project, req.user.id);
  // Tasks, comments, files, memberships, the activity feed and notifications all go via ON DELETE CASCADE.
  await prisma.project.delete({ where: { id: project._id } });
  res.status(200).json({ message: "Project deleted successfully", deleteStatus: true });
});

exports.remove_media_from_project = asyncHandler(async (req, res) => {
  const project = await loadProject(req.params.projectId);
  requireMember(project, req.user.id);
  const item = project.attachedMediaURLSet.find((m) => m.mediaURL === req.body.mediaURL);
  if (!item) throw notFound("Media not found in Project");
  if (!isManager(project, req.user.id) && item.uploadedBy && !idEq(item.uploadedBy, req.user.id)) {
    throw forbidden("Only the uploader or the project manager can remove this file");
  }
  const removedName = item.mediaName || "file";
  await prisma.media.delete({ where: { id: item._id } });
  await touchProject(project._id);
  await logActivity(req.user.id, project._id, "media.removed", { data: { names: [removedName], scope: "project" } });
  res.status(200).json({ message: "Media removed from Project successfully", deleteStatus: true });
});

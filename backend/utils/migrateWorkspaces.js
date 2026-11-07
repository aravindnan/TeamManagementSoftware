const Project = require("../model/project");
const Workspace = require("../model/workspace");
const User = require("../model/user");

/**
 * Brings projects created before workspaces existed into the new model. For each project manager with such projects,
 * a workspace "<First name>'s workspace" is created (or reused) with them as owner; everyone on those projects joins
 * it as a member; the projects are linked to it.
 *
 * Safe to run repeatedly: projects that already belong to a workspace are never touched, and an existing migrated
 * workspace is reused instead of duplicated.
 */
async function migrateLegacyProjects() {
  const legacy = await Project.find({ workspace: { $in: [null, undefined] } }).select("projectManager projectMembers");
  const byManager = new Map();
  for (const project of legacy) {
    const key = String(project.projectManager);
    if (!byManager.has(key)) byManager.set(key, []);
    byManager.get(key).push(project);
  }

  const summary = { workspacesCreated: 0, projectsMigrated: 0, membersAdded: 0 };
  for (const [managerId, projects] of byManager) {
    const manager = await User.findById(managerId).select("firstName").lean();
    if (!manager) continue; // orphaned project: leave it alone rather than guess

    const name = `${manager.firstName}'s workspace`.slice(0, 60);
    let workspace = await Workspace.findOne({ owner: managerId, name });
    if (!workspace) {
      workspace = await Workspace.create({ name, owner: managerId, members: [{ user: managerId, role: "owner" }] });
      summary.workspacesCreated += 1;
    }

    const known = new Set(workspace.members.map((m) => String(m.user)));
    for (const project of projects) {
      for (const memberId of project.projectMembers.map(String)) {
        if (known.has(memberId) || !(await User.exists({ _id: memberId }))) continue;
        workspace.members.push({ user: memberId, role: "member" });
        known.add(memberId);
        summary.membersAdded += 1;
      }
    }
    await workspace.save();
    await Project.updateMany({ _id: { $in: projects.map((p) => p._id) } }, { workspace: workspace._id });
    summary.projectsMigrated += projects.length;
  }
  return summary;
}

module.exports = { migrateLegacyProjects };

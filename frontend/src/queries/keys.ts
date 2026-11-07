/**
 * One place that names every cached query. Keys are hierarchical, so invalidating a project
 * prefix also covers its risk, analytics and activity views.
 */
export const qk = {
  me: ["me"] as const,
  projects: ["project"] as const, // prefix of every project query
  project: (id: string) => ["project", id] as const,
  risk: (id: string) => ["project", id, "risk"] as const,
  analytics: (id: string) => ["project", id, "analytics"] as const,
  activity: (id: string, category: string = "all") => ["project", id, "activity", category] as const,
  tasks: ["task"] as const, // prefix of every task query
  task: (id: string) => ["task", id] as const,
  users: ["users"] as const,
  workspaces: ["workspaces"] as const, // prefix of every workspace query (list, detail, invites)
  workspace: (id: string) => ["workspaces", id] as const,
  workspaceInvites: (id: string) => ["workspaces", id, "invites"] as const,
  myInvites: ["invites", "mine"] as const,
  invitePreview: (token: string) => ["invites", "preview", token] as const,
  notifications: ["notifications"] as const,
  notificationList: (unreadOnly: boolean) => ["notifications", "list", unreadOnly] as const,
  unreadCount: ["notifications", "unread"] as const,
};

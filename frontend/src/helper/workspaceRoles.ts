import type { WorkspaceRole } from "../services/workspaceServices";

// These mirror the server's rules (backend/controller/workspaceController.js). The server is what enforces
// them; the UI only uses these to avoid offering buttons that would be refused.

const RANK: Record<WorkspaceRole, number> = { member: 1, admin: 2, owner: 3 };

/** Admins and the owner manage people, invitations and the workspace name. */
export const canManage = (role: WorkspaceRole | undefined) => !!role && RANK[role] >= RANK.admin;

/** Only the owner changes roles, transfers ownership or deletes the workspace. */
export const isOwner = (role: WorkspaceRole | undefined) => role === "owner";

/** Which roles `myRole` may hand out when inviting. Admins can only invite members. */
export const invitableRoles = (myRole: WorkspaceRole | undefined): ("admin" | "member")[] =>
  myRole === "owner" ? ["member", "admin"] : canManage(myRole) ? ["member"] : [];

/**
 * Whether the remove/leave button is offered for a person.
 * Anyone may leave (except the owner); admins remove members; only the owner removes admins; nobody removes the owner.
 */
export function canRemove(myRole: WorkspaceRole | undefined, targetRole: WorkspaceRole, isSelf: boolean): boolean {
  if (!myRole || targetRole === "owner") return false;
  if (isSelf) return true;
  if (!canManage(myRole)) return false;
  return targetRole === "member" || myRole === "owner";
}

/** Only the owner changes roles, and never the owner's own. */
export const canChangeRole = (myRole: WorkspaceRole | undefined, targetRole: WorkspaceRole) => myRole === "owner" && targetRole !== "owner";

export const roleLabel = (role: WorkspaceRole) => (role === "owner" ? "Owner" : role === "admin" ? "Admin" : "Member");

/** "in 6 days", "in 3 hours", "expired". */
export function expiresIn(expiresAt: string, now: number = Date.now()): string {
  const ms = new Date(expiresAt).getTime() - now;
  if (Number.isNaN(ms) || ms <= 0) return "expired";
  const hours = Math.floor(ms / 3_600_000);
  if (hours < 1) return "in under an hour";
  if (hours < 24) return `in ${hours} hour${hours === 1 ? "" : "s"}`;
  const days = Math.floor(hours / 24);
  return `in ${days} day${days === 1 ? "" : "s"}`;
}

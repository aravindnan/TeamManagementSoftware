import { api, call } from "./apiClient";

export type WorkspaceRole = "owner" | "admin" | "member";

export const getWorkspaces = () => call(api.get("/workspaces"));
export const getWorkspace = (id: string) => call(api.get(`/workspaces/${id}`));
export const createWorkspace = (name: string) => call(api.post("/workspaces", { name }));
export const renameWorkspace = (id: string, name: string) => call(api.patch(`/workspaces/${id}`, { name }));
export const deleteWorkspace = (id: string) => call(api.delete(`/workspaces/${id}`));

export const setMemberRole = (id: string, userId: string, role: "admin" | "member") =>
  call(api.patch(`/workspaces/${id}/members/${userId}`, { role }));
export const removeWorkspaceMember = (id: string, userId: string) => call(api.delete(`/workspaces/${id}/members/${userId}`));
export const transferWorkspace = (id: string, userId: string) => call(api.post(`/workspaces/${id}/transfer`, { userId }));

export const getWorkspaceInvites = (id: string) => call(api.get(`/workspaces/${id}/invites`));
export const createInvite = (id: string, email: string, role: "admin" | "member") =>
  call(api.post(`/workspaces/${id}/invites`, { email, role }));
export const regenerateInvite = (id: string, inviteId: string) => call(api.post(`/workspaces/${id}/invites/${inviteId}/regenerate`));
export const revokeInvite = (id: string, inviteId: string) => call(api.delete(`/workspaces/${id}/invites/${inviteId}`));

// the invited person's side
export const previewInvite = (token: string) => call(api.get(`/invites/preview/${encodeURIComponent(token)}`));
export const acceptInviteByToken = (token: string) => call(api.post("/invites/accept", { token }));
export const getMyInvites = () => call(api.get("/invites/mine"));
export const acceptInviteById = (inviteId: string) => call(api.post(`/invites/${inviteId}/accept`));
export const declineInviteById = (inviteId: string) => call(api.post(`/invites/${inviteId}/decline`));

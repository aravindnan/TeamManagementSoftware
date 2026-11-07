import { api, call } from "./apiClient";

export const createNewProject = (projectDetails: any, userId: string) =>
  call(api.post(`/create-new-project-for-user-id/${userId}`, projectDetails));

export const getProjectById = (projectId: string) => call(api.get(`/get-project-by-id/${projectId}`));

export const addTaskToProject = (projectId: string, taskDetails: any) =>
  call(api.post(`/add-new-task-by-project-id/${projectId}`, taskDetails));

export const deleteProjectById = (projectId: string) => call(api.delete(`/delete-project-by-id/${projectId}`));

export const editProjectById = (projectId: string, updatedInfo: any) =>
  call(api.put(`/edit-project-by-id/${projectId}`, updatedInfo));

export const addMemberToProject = (projectId: string, userData: { memberId: string }) =>
  call(api.post(`/add-new-member-by-project-id/${projectId}`, userData));

export const deleteMemberFromProject = (projectId: string, userData: { memberId: string }) =>
  call(api.delete(`/remove-member-from-project-by-id/${projectId}`, { data: userData }));

export const addCommentToProjectById = (projectId: string, commentData: { messageContent: string }) =>
  call(api.post(`/add-comment-to-project-by-id/${projectId}`, { messageContent: commentData.messageContent }));

export const addMediaToProject = (projectId: string, mediaDataArray: any[]) =>
  call(api.post(`/add-media-to-project/${projectId}`, { mediaDataArray }));

export const deleteMediaFromProject = (projectId: string, mediaURL: string) =>
  call(api.delete(`/remove-media-from-project/${projectId}`, { data: { mediaURL } }));

export const getProjectRisk = (projectId: string) => call(api.get(`/get-project-risk-by-id/${projectId}`));

export type ActivityCategory = "project" | "task" | "comment" | "file" | "member";

export const getProjectActivity = (projectId: string, params: { before?: string; category?: ActivityCategory; limit?: number } = {}) =>
  call(api.get(`/get-project-activity-by-id/${projectId}`, { params }));

import { api, call } from "./apiClient";

export const getTaskById = (taskId: string) => call(api.get(`/get-task-by-id/${taskId}`));

export const editTaskById = (taskId: string, newTaskData: any) => call(api.put(`/edit-task-by-id/${taskId}`, newTaskData));

export const deleteTaskById = (taskId: string) => call(api.delete(`/delete-task-by-id/${taskId}`));

export const changeTaskStatus = (taskId: string, status: string) =>
  call(api.put(`/change-task-status-by-id/${taskId}`, { newStatus: status }));

export const addCommentToTaskById = (taskId: string, commentData: { messageContent: string }) =>
  call(api.post(`/add-comment-to-task-by-id/${taskId}`, { messageContent: commentData.messageContent }));

export const addMediaToTask = (taskId: string, mediaDataArray: any[]) =>
  call(api.post(`/add-media-to-task/${taskId}`, { mediaDataArray }));

export const deleteMediaFromTask = (taskId: string, mediaURL: string) =>
  call(api.delete(`/remove-media-from-task/${taskId}`, { data: { mediaURL } }));

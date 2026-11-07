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

export interface TaskChanges {
  taskTitle?: string;
  taskDescription?: string;
  taskPriority?: "High" | "Medium" | "Low";
  taskStatus?: string;
  dueDate?: string | null;
  labels?: string[];
  estimateHours?: number | null;
  assignedTo?: string;
}

/** Partial update: send only the fields that changed. */
export const patchTask = (taskId: string, changes: TaskChanges) => call(api.patch(`/patch-task-by-id/${taskId}`, changes));

export const addSubtask = (taskId: string, title: string) => call(api.post(`/add-subtask-to-task/${taskId}`, { title }));

export const updateSubtask = (taskId: string, subtaskId: string, changes: { title?: string; done?: boolean }) =>
  call(api.put(`/update-subtask/${taskId}/${subtaskId}`, changes));

export const deleteSubtask = (taskId: string, subtaskId: string) => call(api.delete(`/delete-subtask/${taskId}/${subtaskId}`));

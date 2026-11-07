import { api, call } from "./apiClient";

export const getUnreadCount = () => call(api.get("/notifications/unread-count"));

export const getNotifications = (params: { before?: string; unread?: boolean; limit?: number } = {}) =>
  call(api.get("/notifications", { params: { ...params, unread: params.unread ? "true" : undefined } }));

export const markNotificationRead = (id: string) => call(api.post(`/notifications/${id}/read`));

export const markAllNotificationsRead = () => call(api.post("/notifications/read-all"));

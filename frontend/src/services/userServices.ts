import { api, call } from "./apiClient";

export const getAllUsers = (query?: string) => call(api.get("/get-all-users", { params: query ? { q: query } : undefined }));

export const getUserById = (userId: string) => call(api.get(`/get-user-by-id/${userId}`));

export const editUserById = (userId: string, userData: object) => call(api.put(`/update-user-profile/${userId}`, userData));

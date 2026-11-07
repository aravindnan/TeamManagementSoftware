import { api, call } from "./apiClient";

export const loginUser = (loginData: { username: string; password: string }) => call(api.post("/login", loginData));

export const registerUser = (registerData: any) => call(api.post("/register", registerData));

export const logoutUser = () => call(api.post("/logout"));

/**
 * Who am I? Resolves to the full profile, `null` when there is no valid session (401),
 * or the error object for network/server failures (so callers can show an error state).
 */
export const getMe = async (): Promise<any> => {
  const res = await call(api.get("/me"));
  if (res?.response?.status === 401) return null;
  return res;
};

/** Signs in (or up) with a Google ID token obtained from Google Identity Services. */
export const googleLogin = (credential: string) => call(api.post("/auth/google", { credential }));

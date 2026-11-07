import axios, { AxiosResponse } from "axios";
import { ENV } from "../env/environment";
import { store } from "../redux/store";
import { logoutAction } from "../redux/actions/authActions";
import { queryClient } from "../queries/queryClient";
import { applyMutationEffects } from "../queries/invalidation";

// One axios instance for the whole app. The session lives in an httpOnly cookie set by the API,
// so every request just has to send credentials.
export const api = axios.create({ baseURL: ENV, withCredentials: true, timeout: 20000 });

const PUBLIC_PATHS = ["/", "/login", "/register"];

api.interceptors.response.use(
  (response) => {
    // Keep cached reads honest: every successful write says which cached data it made stale.
    applyMutationEffects(queryClient, response.config.method, response.config.url, response.data);
    return response;
  },
  (error) => {
    const status = error?.response?.status;
    const url: string = error?.config?.url || "";
    const isAuthCall = url === "/login" || url === "/register" || url === "/logout" || url === "/me";
    // Session expired or revoked: clear client state and send the user to log in.
    if (status === 401 && !isAuthCall) {
      store.dispatch(logoutAction());
      queryClient.clear(); // never keep one session's data around after it ends
      if (!PUBLIC_PATHS.includes(window.location.pathname)) window.location.assign("/login");
    }
    return Promise.reject(error);
  }
);

// Keeps the existing service contract used by the pages: resolve with the response body on success,
// and with the error object (never throw) on failure, so callers inspect `res.code` / `res.response`.
export const call = async (request: Promise<AxiosResponse<any>>): Promise<any> => {
  try {
    return (await request).data;
  } catch (error) {
    return error;
  }
};

/** Human-readable message from a failed `call()` result. */
export const errorMessage = (res: any, fallback = "Something went wrong"): string => {
  if (res?.code === "ERR_NETWORK") return "Could not reach the server. Check your connection.";
  return res?.response?.data?.error || res?.message || fallback;
};

/** True when `call()` resolved with an error object rather than data. */
export const isApiError = (res: any): boolean => !!res && (res.isAxiosError === true || res instanceof Error);

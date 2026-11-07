import { isApiError } from "../services/apiClient";

/** Thrown by the session query when there is no valid login (HTTP 401 from /me). */
export class NotSignedInError extends Error {
  constructor() {
    super("Not signed in");
    this.name = "NotSignedInError";
  }
}

/**
 * Our services never throw: they resolve with the response body, or with the error object on failure.
 * TanStack Query needs the opposite, so queryFns pass service results through here: error objects are
 * rethrown (keeping `.code` / `.response` for retry rules and messages) and data is returned as-is.
 */
export function unwrap<T = any>(res: any): T {
  if (isApiError(res)) throw res;
  return res as T;
}

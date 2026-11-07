// Public, build-time configuration only. Secrets must never live in the frontend bundle.
export const ENV = (process.env.REACT_APP_API_URL || "http://localhost:8000").replace(/\/$/, "");

/** Google OAuth client id (public). Empty disables the "Continue with Google" buttons. */
export const GOOGLE_CLIENT_ID = process.env.REACT_APP_GOOGLE_CLIENT_ID || "";

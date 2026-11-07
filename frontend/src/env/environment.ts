// Public, build-time configuration only. Secrets must never live in the frontend bundle.
export const ENV = (process.env.REACT_APP_API_URL || "http://localhost:8000").replace(/\/$/, "");

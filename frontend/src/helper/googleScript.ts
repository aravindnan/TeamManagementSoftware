declare global {
  interface Window {
    google?: any;
  }
}

const SRC = "https://accounts.google.com/gsi/client";
let pending: Promise<void> | null = null;

/** Loads Google Identity Services once. Resolves immediately if it is already there; a failed load can be retried. */
export function loadGoogleScript(): Promise<void> {
  if (typeof window !== "undefined" && window.google?.accounts?.id) return Promise.resolve();
  if (pending) return pending;

  pending = new Promise<void>((resolve, reject) => {
    const script = document.createElement("script");
    script.src = SRC;
    script.async = true;
    script.defer = true;
    script.onload = () => resolve();
    script.onerror = () => {
      pending = null; // allow another attempt (e.g. after an ad blocker is turned off)
      script.remove();
      reject(new Error("Could not load Google sign-in"));
    };
    document.head.appendChild(script);
  });
  return pending;
}

/** For tests. */
export const resetGoogleScriptLoader = () => {
  pending = null;
};

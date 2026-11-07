/**
 * Where to go after signing in. The destination arrives in the URL (`?redirect=/invite/abc`), which anyone can craft,
 * so it is only honoured when it is a path inside this app. Anything that could leave the site (absolute URLs,
 * protocol-relative `//evil.com`, backslash tricks, `javascript:`) falls back to the default.
 */
export function safeRedirect(target: string | null | undefined, fallback = "/dashboard"): string {
  if (!target) return fallback;
  if (!target.startsWith("/")) return fallback; // absolute URLs, javascript:, relative paths
  if (target.startsWith("//") || target.includes("\\")) return fallback; // protocol-relative and backslash tricks
  for (let i = 0; i < target.length; i++) if (target.charCodeAt(i) < 32) return fallback; // control characters (a smuggled newline or tab)
  try {
    // Resolving against a throwaway origin proves it stays on that origin.
    const resolved = new URL(target, "http://app.invalid");
    if (resolved.origin !== "http://app.invalid") return fallback;
    return resolved.pathname + resolved.search + resolved.hash;
  } catch {
    return fallback;
  }
}

/** `/login?redirect=...` that carries the destination through the sign-in/sign-up pages. */
export const withRedirect = (page: string, redirect: string | null | undefined, extra: Record<string, string> = {}) => {
  const params = new URLSearchParams(extra);
  if (redirect) params.set("redirect", redirect);
  const query = params.toString();
  return query ? `${page}?${query}` : page;
};

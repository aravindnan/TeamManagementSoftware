import type { QueryClient } from "@tanstack/react-query";
import { qk } from "./keys";

/**
 * Declares, in one table, which cached data each successful write makes out of date.
 * Components never coordinate refreshes themselves: they just call a service, and this runs
 * from the HTTP layer when the request succeeds. Only queries that are currently on screen refetch;
 * the rest are marked stale and refresh the next time they are used.
 */

interface Ctx {
  client: QueryClient;
  /** First path parameter of the matched URL (project, task or user id). */
  id: string;
  /** Parsed response body. */
  data: any;
}

interface Rule {
  method: "post" | "put" | "delete";
  pattern: RegExp;
  apply: (ctx: Ctx) => void;
}

const invalidate = (client: QueryClient, queryKey: readonly unknown[]) => client.invalidateQueries({ queryKey });

/** Every project's activity feed (we often know the task id but not its project id). */
const invalidateAllActivity = (client: QueryClient) =>
  client.invalidateQueries({ predicate: (q) => q.queryKey[0] === "project" && q.queryKey[2] === "activity" });

/** Adds a freshly created comment to a cached document without refetching the whole thing. */
function appendComment(client: QueryClient, queryKey: readonly unknown[], field: "projectComments" | "taskComments", comment: any) {
  if (!comment) return;
  client.setQueryData(queryKey, (old: any) => {
    if (!old) return old;
    const existing: any[] = old[field] || [];
    if (existing.some((c) => c._id === comment._id)) return old;
    return { ...old, [field]: [...existing, comment] };
  });
}

// ---- project-scoped writes: the project (and so its risk/analytics/activity) and the user's own lists
const projectChanged = ({ client, id }: Ctx) => {
  invalidate(client, qk.project(id));
  invalidate(client, qk.me);
};

// ---- task-scoped writes: the task, every project that lists it, and the user's own lists
const taskChanged = ({ client, id }: Ctx) => {
  invalidate(client, qk.task(id));
  invalidate(client, qk.projects);
  invalidate(client, qk.me);
};

export const RULES: Rule[] = [
  // comments are patched into the cache; only the activity feed needs a refresh
  {
    method: "post",
    pattern: /^\/add-comment-to-project-by-id\/(\w+)$/,
    apply: ({ client, id, data }) => {
      appendComment(client, qk.project(id), "projectComments", data?.comment);
      invalidate(client, ["project", id, "activity"]);
    },
  },
  {
    method: "post",
    pattern: /^\/add-comment-to-task-by-id\/(\w+)$/,
    apply: ({ client, id, data }) => {
      appendComment(client, qk.task(id), "taskComments", data?.comment);
      invalidateAllActivity(client);
    },
  },

  { method: "post", pattern: /^\/add-media-to-project\/(\w+)$/, apply: projectChanged },
  { method: "delete", pattern: /^\/remove-media-from-project\/(\w+)$/, apply: projectChanged },
  { method: "put", pattern: /^\/edit-project-by-id\/(\w+)$/, apply: projectChanged },
  { method: "post", pattern: /^\/add-new-member-by-project-id\/(\w+)$/, apply: projectChanged },
  { method: "delete", pattern: /^\/remove-member-from-project-by-id\/(\w+)$/, apply: projectChanged },
  { method: "post", pattern: /^\/add-new-task-by-project-id\/(\w+)$/, apply: projectChanged },
  {
    method: "delete",
    pattern: /^\/delete-project-by-id\/(\w+)$/,
    apply: ({ client, id }) => {
      client.removeQueries({ queryKey: qk.project(id) }); // gone: never show it from cache again
      invalidate(client, qk.tasks);
      invalidate(client, qk.me);
    },
  },

  { method: "put", pattern: /^\/change-task-status-by-id\/(\w+)$/, apply: taskChanged },
  { method: "put", pattern: /^\/edit-task-by-id\/(\w+)$/, apply: taskChanged },
  {
    method: "delete",
    pattern: /^\/delete-task-by-id\/(\w+)$/,
    apply: ({ client, id }) => {
      client.removeQueries({ queryKey: qk.task(id) });
      invalidate(client, qk.projects);
      invalidate(client, qk.me);
    },
  },
  {
    method: "post",
    pattern: /^\/add-media-to-task\/(\w+)$/,
    apply: ({ client, id }) => {
      invalidate(client, qk.task(id));
      invalidateAllActivity(client);
    },
  },
  {
    method: "delete",
    pattern: /^\/remove-media-from-task\/(\w+)$/,
    apply: ({ client, id }) => {
      invalidate(client, qk.task(id));
      invalidateAllActivity(client);
    },
  },

  // the user's own record
  { method: "post", pattern: /^\/create-new-project-for-user-id\/(\w+)$/, apply: ({ client }) => invalidate(client, qk.me) },
  {
    method: "put",
    pattern: /^\/update-user-profile\/(\w+)$/,
    apply: ({ client }) => {
      // the user's name and details appear on projects and tasks too
      invalidate(client, qk.me);
      invalidate(client, qk.projects);
      invalidate(client, qk.tasks);
    },
  },

  // notifications read state is updated optimistically by the inbox; this just reconciles with the server
  { method: "post", pattern: /^\/notifications\/(\w+)\/read$/, apply: ({ client }) => invalidate(client, qk.unreadCount) },
  { method: "post", pattern: /^\/notifications\/read-all$/, apply: ({ client }) => invalidate(client, qk.notifications) },

  // a different person may be about to use this browser: never let one user's cache reach another
  { method: "post", pattern: /^\/(login|logout|register)$/, apply: ({ client }) => client.clear() },
];

/** Called by the HTTP layer after every successful request. Reads (GET) never match. */
export function applyMutationEffects(client: QueryClient, method: string | undefined, url: string | undefined, data: any) {
  if (!method || !url) return;
  const m = method.toLowerCase();
  if (m === "get") return;
  const path = url.split("?")[0];
  for (const rule of RULES) {
    if (rule.method !== m) continue;
    const match = path.match(rule.pattern);
    if (match) {
      rule.apply({ client, id: match[1], data });
      return;
    }
  }
}

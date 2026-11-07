import { QueryClient } from "@tanstack/react-query";
import { createQueryClient, shouldRetry } from "./queryClient";
import { applyMutationEffects } from "./invalidation";
import { NotSignedInError, unwrap } from "./unwrap";
import { qk } from "./keys";

jest.mock("../services/apiClient", () => ({ isApiError: (r: any) => !!r && r.isAxiosError === true }));

const P = "p1", Q = "p2", T = "t1";
let client: QueryClient;
const stale = (key: readonly unknown[]) => client.getQueryState(key)?.isInvalidated === true;
const exists = (key: readonly unknown[]) => client.getQueryState(key) !== undefined;

beforeEach(() => {
  client = createQueryClient();
  client.setQueryData(qk.me, { _id: "me" });
  client.setQueryData(qk.project(P), { _id: P, projectComments: [{ _id: "c0" }], allTasks: [] });
  client.setQueryData(qk.project(Q), { _id: Q, projectComments: [] });
  client.setQueryData(qk.risk(P), {});
  client.setQueryData(qk.analytics(P), {});
  client.setQueryData(qk.activity(P, "all"), {});
  client.setQueryData(qk.activity(P, "comment"), {});
  client.setQueryData(qk.activity(Q, "all"), {});
  client.setQueryData(qk.task(T), { _id: T, taskComments: [] });
  client.setQueryData(qk.unreadCount, 3);
});

const run = (method: string, url: string, data: any = {}) => applyMutationEffects(client, method, url, data);

describe("reads and unknown writes", () => {
  test("GET requests never change the cache", () => {
    run("get", `/get-project-by-id/${P}`);
    expect(stale(qk.project(P))).toBe(false);
  });
  test("unknown URLs are ignored", () => {
    run("post", "/something-else/xyz");
    expect(stale(qk.me)).toBe(false);
  });
  test("query strings and method case do not matter", () => {
    run("PUT", `/edit-project-by-id/${P}?x=1`);
    expect(stale(qk.project(P))).toBe(true);
  });
});

describe("comments are patched in, not refetched", () => {
  test("a project comment is appended to the cached project; only the activity feed refreshes", () => {
    run("post", `/add-comment-to-project-by-id/${P}`, { comment: { _id: "c1", messageContent: "hi" } });
    expect((client.getQueryData(qk.project(P)) as any).projectComments.map((c: any) => c._id)).toEqual(["c0", "c1"]);
    expect(stale(qk.project(P))).toBe(false); // no whole-project refetch
    expect(stale(qk.activity(P, "all"))).toBe(true);
    expect(stale(qk.activity(P, "comment"))).toBe(true);
    expect(stale(qk.activity(Q, "all"))).toBe(false); // other projects untouched
  });
  test("applying the same comment twice does not duplicate it", () => {
    const comment = { _id: "c1" };
    run("post", `/add-comment-to-project-by-id/${P}`, { comment });
    run("post", `/add-comment-to-project-by-id/${P}`, { comment });
    expect((client.getQueryData(qk.project(P)) as any).projectComments).toHaveLength(2);
  });
  test("a task comment is appended to the cached task", () => {
    run("post", `/add-comment-to-task-by-id/${T}`, { comment: { _id: "c9" } });
    expect((client.getQueryData(qk.task(T)) as any).taskComments.map((c: any) => c._id)).toEqual(["c9"]);
    expect(stale(qk.task(T))).toBe(false);
    expect(stale(qk.activity(P, "all"))).toBe(true);
  });
  test("a missing response comment or uncached project is harmless", () => {
    run("post", `/add-comment-to-project-by-id/${P}`, {});
    expect((client.getQueryData(qk.project(P)) as any).projectComments).toHaveLength(1);
    expect(() => run("post", "/add-comment-to-project-by-id/unknown", { comment: { _id: "x" } })).not.toThrow();
  });
});

describe("project writes", () => {
  test.each([
    ["post", `/add-media-to-project/${P}`],
    ["delete", `/remove-media-from-project/${P}`],
    ["put", `/edit-project-by-id/${P}`],
    ["post", `/add-new-member-by-project-id/${P}`],
    ["delete", `/remove-member-from-project-by-id/${P}`],
    ["post", `/add-new-task-by-project-id/${P}`],
  ])("%s %s refreshes that project, its derived views and the user's lists, and nothing else", (method, url) => {
    run(method, url);
    for (const key of [qk.project(P), qk.risk(P), qk.analytics(P), qk.activity(P, "all"), qk.me]) expect(stale(key)).toBe(true);
    expect(stale(qk.project(Q))).toBe(false);
    expect(stale(qk.activity(Q, "all"))).toBe(false);
    expect(stale(qk.task(T))).toBe(false);
  });
  test("deleting a project drops it from the cache entirely", () => {
    run("delete", `/delete-project-by-id/${P}`);
    expect(exists(qk.project(P))).toBe(false);
    expect(exists(qk.risk(P))).toBe(false);
    expect(stale(qk.me)).toBe(true);
    expect(exists(qk.project(Q))).toBe(true);
  });
});

describe("task writes", () => {
  test.each([
    ["put", `/change-task-status-by-id/${T}`],
    ["put", `/edit-task-by-id/${T}`],
  ])("%s %s refreshes the task, every project and the user's lists", (method, url) => {
    run(method, url);
    for (const key of [qk.task(T), qk.project(P), qk.project(Q), qk.risk(P), qk.analytics(P), qk.me]) expect(stale(key)).toBe(true);
  });
  test("deleting a task drops it and refreshes the projects that listed it", () => {
    run("delete", `/delete-task-by-id/${T}`);
    expect(exists(qk.task(T))).toBe(false);
    expect(stale(qk.project(P))).toBe(true);
    expect(stale(qk.me)).toBe(true);
  });
  test("task attachments refresh the task and activity, not the projects", () => {
    run("post", `/add-media-to-task/${T}`);
    expect(stale(qk.task(T))).toBe(true);
    expect(stale(qk.activity(P, "all"))).toBe(true);
    expect(stale(qk.project(P))).toBe(false);
  });
});

describe("user writes", () => {
  test("creating a project only refreshes the user's lists", () => {
    run("post", "/create-new-project-for-user-id/u1");
    expect(stale(qk.me)).toBe(true);
    expect(stale(qk.project(P))).toBe(false);
  });
  test("a profile edit refreshes the user and every place their name appears", () => {
    run("put", "/update-user-profile/u1");
    for (const key of [qk.me, qk.project(P), qk.project(Q), qk.task(T)]) expect(stale(key)).toBe(true);
  });
});

describe("notifications and sessions", () => {
  test("reading a notification reconciles the badge; read-all refreshes the whole inbox", () => {
    client.setQueryData(qk.notificationList(false), {});
    run("post", "/notifications/abc123/read");
    expect(stale(qk.unreadCount)).toBe(true);
    expect(stale(qk.notificationList(false))).toBe(false);
    run("post", "/notifications/read-all");
    expect(stale(qk.notificationList(false))).toBe(true);
  });
  test.each(["/login", "/logout", "/register"])("%s clears the whole cache so users never see each other's data", (url) => {
    run("post", url);
    expect(client.getQueryCache().getAll()).toHaveLength(0);
  });
});

describe("unwrap", () => {
  test("returns data untouched and rethrows error objects with their details", () => {
    expect(unwrap({ a: 1 })).toEqual({ a: 1 });
    const err = { isAxiosError: true, response: { status: 404 } };
    expect(() => unwrap(err)).toThrow();
    try { unwrap(err); } catch (e) { expect(e).toBe(err); }
  });
});

describe("shouldRetry", () => {
  test("retries network failures and server errors at most twice", () => {
    expect(shouldRetry(0, { code: "ERR_NETWORK" })).toBe(true);
    expect(shouldRetry(1, { response: { status: 503 } })).toBe(true);
    expect(shouldRetry(2, { response: { status: 503 } })).toBe(false);
  });
  test("never retries answers: 4xx or a missing session", () => {
    for (const status of [400, 401, 403, 404, 409]) expect(shouldRetry(0, { response: { status } })).toBe(false);
    expect(shouldRetry(0, new NotSignedInError())).toBe(false);
  });
});

describe("task drawer writes", () => {
  test("a PATCH refreshes the task, every project (including the task's own history) and the user's lists", () => {
    client.setQueryData(qk.activity(P, `task:${T}`), {});
    run("patch", `/patch-task-by-id/${T}`);
    for (const key of [qk.task(T), qk.project(P), qk.project(Q), qk.activity(P, `task:${T}`), qk.me]) expect(stale(key)).toBe(true);
  });

  test.each([
    ["post", `/add-subtask-to-task/${T}`],
    ["put", `/update-subtask/${T}/s1`],
    ["delete", `/delete-subtask/${T}/s1`],
  ])("%s %s writes the returned sub-tasks into the cached task without refetching it", (method, url) => {
    client.setQueryData(qk.activity(P, `task:${T}`), {});
    run(method, url, { subtasks: [{ _id: "s1", title: "One", done: true }] });
    expect((client.getQueryData(qk.task(T)) as any).subtasks).toEqual([{ _id: "s1", title: "One", done: true }]);
    expect(stale(qk.task(T))).toBe(false); // no refetch of the task itself
    expect(stale(qk.project(P))).toBe(true); // cards show sub-task progress
    expect(stale(qk.me)).toBe(false); // sub-tasks do not change the user's lists
  });

  test("if the response has no sub-task list, the task is refetched to be safe", () => {
    run("post", `/add-subtask-to-task/${T}`, {});
    expect(stale(qk.task(T))).toBe(true);
  });

  test("sub-task writes for an uncached task are harmless", () => {
    expect(() => run("post", "/add-subtask-to-task/unknown", { subtasks: [] })).not.toThrow();
  });
});

import React from "react";
import { act, renderHook, screen, waitFor } from "@testing-library/react";
import { Route, Routes } from "react-router-dom";
import { getMe } from "../services/authServices";
import { getProjectActivity, getProjectById } from "../services/projectServices";
import { getUnreadCount } from "../services/notificationServices";
import { hookWrapper, makeTestClient, makeTestStore, renderWithProviders } from "../testUtils";
import { useMe, useProject, useProjectActivity, useRequireMe, useUnreadCount } from "./hooks";
import { NotSignedInError } from "./unwrap";
import { qk } from "./keys";

jest.mock("../services/authServices", () => ({ getMe: jest.fn() }));
jest.mock("../services/projectServices", () => ({ getProjectById: jest.fn(), getProjectActivity: jest.fn() }));
jest.mock("../services/notificationServices", () => ({ getUnreadCount: jest.fn(), getNotifications: jest.fn() }));
jest.mock("../services/apiClient", () => ({ isApiError: (r: any) => !!r && r.isAxiosError === true }));

const notFound = { isAxiosError: true, response: { status: 404, data: { error: "Project not found" } } };

beforeEach(() => {
  (getMe as jest.Mock).mockReset();
  (getProjectById as jest.Mock).mockReset();
  (getProjectActivity as jest.Mock).mockReset();
  (getUnreadCount as jest.Mock).mockReset();
});

describe("useMe", () => {
  test("returns the profile", async () => {
    (getMe as jest.Mock).mockResolvedValue({ _id: "me", firstName: "Ann" });
    const { result } = renderHook(() => useMe(), { wrapper: hookWrapper(makeTestClient()) });
    await waitFor(() => expect(result.current.data).toEqual({ _id: "me", firstName: "Ann" }));
  });
  test("a 401 (null from getMe) becomes NotSignedInError and is not retried", async () => {
    (getMe as jest.Mock).mockResolvedValue(null);
    const { result } = renderHook(() => useMe(), { wrapper: hookWrapper(makeTestClient()) });
    await waitFor(() => expect(result.current.error).toBeInstanceOf(NotSignedInError));
    expect(getMe).toHaveBeenCalledTimes(1);
  });
  test("many components asking at once cause a single request", async () => {
    (getMe as jest.Mock).mockResolvedValue({ _id: "me" });
    const client = makeTestClient();
    const wrapper = hookWrapper(client);
    const a = renderHook(() => useMe(), { wrapper });
    const b = renderHook(() => useMe(), { wrapper });
    await waitFor(() => expect(a.result.current.data).toBeDefined());
    await waitFor(() => expect(b.result.current.data).toBeDefined());
    expect(getMe).toHaveBeenCalledTimes(1);
  });
});

describe("useRequireMe", () => {
  const Probe = () => {
    const q = useRequireMe();
    return <div>{q.data ? `hello ${q.data.firstName}` : "waiting"}</div>;
  };
  const app = () => (
    <Routes>
      <Route path="/" element={<Probe />} />
      <Route path="/login" element={<div>login page</div>} />
    </Routes>
  );

  test("mirrors the profile into Redux for components that still read it from there", async () => {
    (getMe as jest.Mock).mockResolvedValue({ _id: "me", firstName: "Ann" });
    const { store } = renderWithProviders(app(), { store: makeTestStore(false, null) });
    expect(await screen.findByText("hello Ann")).toBeInTheDocument();
    await waitFor(() => expect(store.getState().authReducer.myUserProfile).toEqual({ _id: "me", firstName: "Ann" }));
    expect(store.getState().authReducer.isAuthenticated).toBe(true);
  });

  test("sends a signed-out visitor to the login page and clears the Redux profile", async () => {
    (getMe as jest.Mock).mockResolvedValue(null);
    const { store } = renderWithProviders(app(), { store: makeTestStore(true, { _id: "stale" }) });
    expect(await screen.findByText("login page")).toBeInTheDocument();
    expect(store.getState().authReducer.isAuthenticated).toBe(false);
    expect(store.getState().authReducer.myUserProfile).toBeNull();
  });

  test("a server error does not log the user out", async () => {
    (getMe as jest.Mock).mockResolvedValue({ isAxiosError: true, response: { status: 500 } });
    renderWithProviders(app());
    await waitFor(() => expect(getMe).toHaveBeenCalled());
    expect(screen.queryByText("login page")).not.toBeInTheDocument();
  });
});

describe("useProject", () => {
  test("does nothing without an id", () => {
    renderHook(() => useProject(null), { wrapper: hookWrapper(makeTestClient()) });
    expect(getProjectById).not.toHaveBeenCalled();
  });

  test("serves a second mount from the cache without another request, then keeps it", async () => {
    (getProjectById as jest.Mock).mockResolvedValue({ _id: "p1", projectName: "Relaunch" });
    const client = makeTestClient();
    client.setDefaultOptions({ queries: { retry: false, gcTime: Infinity, staleTime: 60_000 } }); // fresh for a minute
    const wrapper = hookWrapper(client);
    const first = renderHook(() => useProject("p1"), { wrapper });
    await waitFor(() => expect(first.result.current.data?.projectName).toBe("Relaunch"));
    first.unmount(); // navigate away...
    const second = renderHook(() => useProject("p1"), { wrapper }); // ...and come back
    expect(second.result.current.data?.projectName).toBe("Relaunch"); // instant, no loading state
    expect(second.result.current.isPending).toBe(false);
    expect(getProjectById).toHaveBeenCalledTimes(1);
  });

  test("an error response surfaces as an error with its details, without retrying a 404", async () => {
    (getProjectById as jest.Mock).mockResolvedValue(notFound);
    const { result } = renderHook(() => useProject("nope"), { wrapper: hookWrapper(makeTestClient()) });
    await waitFor(() => expect(result.current.isError).toBe(true));
    expect((result.current.error as any).response.status).toBe(404);
    expect(getProjectById).toHaveBeenCalledTimes(1);
  });

  test("invalidating the project refetches it in the background while the old data stays visible", async () => {
    (getProjectById as jest.Mock).mockResolvedValueOnce({ _id: "p1", projectName: "Old" });
    const client = makeTestClient();
    const { result } = renderHook(() => useProject("p1"), { wrapper: hookWrapper(client) });
    await waitFor(() => expect(result.current.data?.projectName).toBe("Old"));
    (getProjectById as jest.Mock).mockResolvedValueOnce({ _id: "p1", projectName: "New" });
    act(() => {
      client.invalidateQueries({ queryKey: qk.project("p1") });
    });
    expect(result.current.data?.projectName).toBe("Old"); // no flash of a loading state
    await waitFor(() => expect(result.current.data?.projectName).toBe("New"));
  });
});

describe("useProjectActivity", () => {
  test("pages through the feed using the server cursor and keeps filters separate", async () => {
    (getProjectActivity as jest.Mock)
      .mockResolvedValueOnce({ items: [{ _id: "2" }], nextCursor: "2" })
      .mockResolvedValueOnce({ items: [{ _id: "1" }], nextCursor: null });
    const { result } = renderHook(() => useProjectActivity("p1", "comment", 1), { wrapper: hookWrapper(makeTestClient()) });
    await waitFor(() => expect(result.current.data?.pages).toHaveLength(1));
    expect(getProjectActivity).toHaveBeenLastCalledWith("p1", { limit: 1, category: "comment" });
    expect(result.current.hasNextPage).toBe(true);
    await act(async () => {
      await result.current.fetchNextPage();
    });
    await waitFor(() => expect(result.current.data?.pages).toHaveLength(2));
    expect(getProjectActivity).toHaveBeenLastCalledWith("p1", { limit: 1, before: "2", category: "comment" });
    expect(result.current.data?.pages.flatMap((p) => p.items.map((i: any) => i._id))).toEqual(["2", "1"]);
    expect(result.current.hasNextPage).toBe(false);
  });
  test("the 'all' filter sends no category", async () => {
    (getProjectActivity as jest.Mock).mockResolvedValue({ items: [], nextCursor: null });
    renderHook(() => useProjectActivity("p1", "all"), { wrapper: hookWrapper(makeTestClient()) });
    await waitFor(() => expect(getProjectActivity).toHaveBeenCalled());
    expect((getProjectActivity as jest.Mock).mock.calls[0][1]).not.toHaveProperty("category");
  });
});

describe("useUnreadCount", () => {
  test("returns the number and does not run when disabled", async () => {
    (getUnreadCount as jest.Mock).mockResolvedValue({ count: 4 });
    const disabled = renderHook(() => useUnreadCount(false), { wrapper: hookWrapper(makeTestClient()) });
    expect(disabled.result.current.fetchStatus).toBe("idle");
    expect(getUnreadCount).not.toHaveBeenCalled();
    const enabled = renderHook(() => useUnreadCount(true), { wrapper: hookWrapper(makeTestClient()) });
    await waitFor(() => expect(enabled.result.current.data).toBe(4));
  });
});

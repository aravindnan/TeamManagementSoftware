import React from "react";
import { screen, fireEvent, waitFor } from "@testing-library/react";
import NotificationBell from "../components/NotificationBell";
import NotificationsModal from "./NotificationsModal";
import { getNotifications, getUnreadCount, markAllNotificationsRead, markNotificationRead } from "../services/notificationServices";
import { qk } from "../queries/keys";
import { makeTestClient, makeTestStore, renderWithProviders } from "../testUtils";

const mockNavigate = jest.fn();
jest.mock("react-router-dom", () => ({ ...jest.requireActual("react-router-dom"), useNavigate: () => mockNavigate }));
jest.mock("../services/notificationServices", () => ({
  getNotifications: jest.fn(),
  getUnreadCount: jest.fn(),
  markNotificationRead: jest.fn(),
  markAllNotificationsRead: jest.fn(),
}));
jest.mock("../services/apiClient", () => ({
  errorMessage: (res: any, fallback: string) => res?.response?.data?.error || fallback,
  isApiError: (res: any) => !!res && res.isAxiosError === true,
}));

const now = new Date().toISOString();
const note = (id: string, type: string, data: any, extra: any = {}) => ({
  _id: id, type, actorName: "Ana Lee", projectName: "Relaunch", project: "p1", data, createdAt: now, ...extra,
});
const page = (items: any[], extra: any = {}) => ({ items, nextCursor: null, unreadCount: items.filter((i) => !i.readAt).length, ...extra });
const unreadOf = (items: any[]) => ({ count: items.filter((i) => !i.readAt).length });

beforeEach(() => {
  mockNavigate.mockReset();
  (getNotifications as jest.Mock).mockReset();
  (getUnreadCount as jest.Mock).mockReset();
  (markNotificationRead as jest.Mock).mockReset().mockResolvedValue({ ok: true });
  (markAllNotificationsRead as jest.Mock).mockReset();
});

describe("NotificationBell", () => {
  test("shows the unread count in the badge and in its accessible name", async () => {
    (getUnreadCount as jest.Mock).mockResolvedValue({ count: 3 });
    renderWithProviders(<NotificationBell />);
    expect(await screen.findByRole("button", { name: "Notifications, 3 unread" })).toBeInTheDocument();
    expect(screen.getByText("3")).toBeInTheDocument();
  });

  test("caps big counts and hides the badge at zero", async () => {
    (getUnreadCount as jest.Mock).mockResolvedValue({ count: 250 });
    const { unmount } = renderWithProviders(<NotificationBell />);
    expect(await screen.findByText("99+")).toBeInTheDocument();
    unmount();
    (getUnreadCount as jest.Mock).mockResolvedValue({ count: 0 });
    renderWithProviders(<NotificationBell />);
    await waitFor(() => expect(getUnreadCount).toHaveBeenCalledTimes(2));
    expect(screen.getByRole("button", { name: "Notifications" })).toBeInTheDocument();
    expect(screen.queryByText("0")).not.toBeInTheDocument();
  });

  test("does not poll while signed out", () => {
    renderWithProviders(<NotificationBell />, { store: makeTestStore(false) });
    expect(getUnreadCount).not.toHaveBeenCalled();
  });

  test("two bells (sidebar and top bar) share one request", async () => {
    (getUnreadCount as jest.Mock).mockResolvedValue({ count: 2 });
    renderWithProviders(
      <>
        <NotificationBell />
        <NotificationBell />
      </>
    );
    await waitFor(() => expect(screen.getAllByRole("button", { name: "Notifications, 2 unread" })).toHaveLength(2));
    expect(getUnreadCount).toHaveBeenCalledTimes(1);
  });
});

describe("NotificationsModal", () => {
  const items = (list: any[]) => {
    (getNotifications as jest.Mock).mockResolvedValue(page(list));
    (getUnreadCount as jest.Mock).mockResolvedValue(unreadOf(list));
  };

  test("renders notifications addressed to the recipient", async () => {
    items([note("2", "task.created", { title: "Ship it", priority: "High" }, { task: "t1" }), note("1", "member.added", {}, { readAt: now })]);
    renderWithProviders(<NotificationsModal setOpen={() => {}} />);
    expect(await screen.findByText(/assigned you/)).toBeInTheDocument();
    expect(screen.getByText("Ship it")).toBeInTheDocument();
    expect(screen.getByText(/added you to/)).toBeInTheDocument();
    expect(screen.getAllByLabelText("Unread")).toHaveLength(1);
  });

  test("opening an unread item marks it read optimistically, updates the badge and navigates", async () => {
    items([note("2", "task.created", { title: "Ship it" }, { task: "t1" })]);
    const setOpen = jest.fn();
    const { client } = renderWithProviders(<NotificationsModal setOpen={setOpen} />);
    await waitFor(() => expect(client.getQueryData(qk.unreadCount)).toBe(1));
    fireEvent.click(await screen.findByText("Ship it"));
    expect(markNotificationRead).toHaveBeenCalledWith("2");
    await waitFor(() => expect(client.getQueryData(qk.unreadCount)).toBe(0));
    expect(mockNavigate).toHaveBeenCalledWith("/project-page?id=p1&task=t1"); // opens the task in its project's drawer
    expect(setOpen).toHaveBeenCalledWith(false);
  });

  test("a failed mark-read re-syncs with the server instead of leaving the UI wrong", async () => {
    items([note("2", "task.created", { title: "Ship it" }, { task: "t1" })]);
    (markNotificationRead as jest.Mock).mockResolvedValue({ isAxiosError: true });
    const { client } = renderWithProviders(<NotificationsModal setOpen={() => {}} />);
    await waitFor(() => expect(client.getQueryData(qk.unreadCount)).toBe(1));
    fireEvent.click(await screen.findByText("Ship it"));
    // the active inbox list is invalidated, so it is fetched again to restore the truth
    await waitFor(() => expect(getNotifications).toHaveBeenCalledTimes(2));
  });

  test("an item whose target is gone is marked read but stays open and does not navigate", async () => {
    items([note("3", "task.deleted", { title: "Old task" }, { task: "t9" })]);
    const setOpen = jest.fn();
    renderWithProviders(<NotificationsModal setOpen={setOpen} />);
    fireEvent.click(await screen.findByText("Old task"));
    expect(markNotificationRead).toHaveBeenCalledWith("3");
    expect(mockNavigate).not.toHaveBeenCalled();
    expect(setOpen).not.toHaveBeenCalled();
  });

  test("'Mark all as read' clears every dot and zeroes the badge", async () => {
    items([note("2", "task.created", { title: "A" }, { task: "a" }), note("1", "task.created", { title: "B" }, { task: "b" })]);
    (markAllNotificationsRead as jest.Mock).mockResolvedValue({ ok: true, updated: 2 });
    const { client } = renderWithProviders(<NotificationsModal setOpen={() => {}} />);
    await screen.findByText("A");
    await waitFor(() => expect(client.getQueryData(qk.unreadCount)).toBe(2));
    fireEvent.click(screen.getByRole("button", { name: /mark all as read/i }));
    await waitFor(() => expect(screen.queryAllByLabelText("Unread")).toHaveLength(0));
    expect(client.getQueryData(qk.unreadCount)).toBe(0);
    expect(screen.getByRole("button", { name: /mark all as read/i })).toBeDisabled();
  });

  test("a failed mark-all shows an error", async () => {
    items([note("2", "task.created", { title: "A" }, { task: "a" })]);
    (markAllNotificationsRead as jest.Mock).mockResolvedValue({ isAxiosError: true, response: { data: { error: "Server said no" } } });
    renderWithProviders(<NotificationsModal setOpen={() => {}} />);
    await screen.findByText("A");
    await waitFor(() => expect(screen.getByRole("button", { name: /mark all as read/i })).not.toBeDisabled());
    fireEvent.click(screen.getByRole("button", { name: /mark all as read/i }));
    expect(await screen.findByRole("alert")).toHaveTextContent("Server said no");
  });

  test("the Unread filter asks the server for unread items and shows a friendly empty state", async () => {
    (getUnreadCount as jest.Mock).mockResolvedValue({ count: 0 });
    (getNotifications as jest.Mock)
      .mockResolvedValueOnce(page([note("1", "task.created", { title: "A" }, { readAt: now, task: "a" })]))
      .mockResolvedValueOnce(page([]));
    renderWithProviders(<NotificationsModal setOpen={() => {}} />);
    await screen.findByText("A");
    fireEvent.click(screen.getByRole("button", { name: "Unread" }));
    expect(await screen.findByText("You're all caught up")).toBeInTheDocument();
    expect(getNotifications).toHaveBeenLastCalledWith(expect.objectContaining({ unread: true }));
  });

  test("'Load older' appends the next page using the cursor", async () => {
    (getUnreadCount as jest.Mock).mockResolvedValue({ count: 2 });
    (getNotifications as jest.Mock)
      .mockResolvedValueOnce(page([note("2", "task.created", { title: "Newer" }, { task: "a" })], { nextCursor: "2" }))
      .mockResolvedValueOnce(page([note("1", "task.created", { title: "Older" }, { task: "b" })]));
    renderWithProviders(<NotificationsModal setOpen={() => {}} />);
    await screen.findByText("Newer");
    fireEvent.click(screen.getByRole("button", { name: /load older notifications/i }));
    expect(await screen.findByText("Older")).toBeInTheDocument();
    expect(getNotifications).toHaveBeenLastCalledWith(expect.objectContaining({ before: "2" }));
  });

  test("shows an error with a retry that recovers", async () => {
    (getUnreadCount as jest.Mock).mockResolvedValue({ count: 0 });
    (getNotifications as jest.Mock).mockResolvedValueOnce({ isAxiosError: true, response: { data: { error: "Boom" } } });
    renderWithProviders(<NotificationsModal setOpen={() => {}} />);
    expect(await screen.findByRole("alert")).toHaveTextContent("Boom");
    (getNotifications as jest.Mock).mockResolvedValueOnce(page([note("1", "task.created", { title: "Back" }, { task: "a" })]));
    fireEvent.click(screen.getByRole("button", { name: "Retry" }));
    expect(await screen.findByText("Back")).toBeInTheDocument();
  });
});

test("makeTestClient is isolated per call", () => {
  expect(makeTestClient()).not.toBe(makeTestClient());
});

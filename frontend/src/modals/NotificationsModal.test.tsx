import React from "react";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import { Provider } from "react-redux";
import { configureStore } from "@reduxjs/toolkit";
import { MemoryRouter } from "react-router-dom";
import { rootReducer } from "../redux/rootReducer";
import NotificationBell from "../components/NotificationBell";
import NotificationsModal from "./NotificationsModal";
import { getNotifications, markAllNotificationsRead, markNotificationRead } from "../services/notificationServices";

const mockNavigate = jest.fn();
jest.mock("react-router-dom", () => ({ ...jest.requireActual("react-router-dom"), useNavigate: () => mockNavigate }));
jest.mock("../services/notificationServices", () => ({
  getNotifications: jest.fn(),
  markNotificationRead: jest.fn(),
  markAllNotificationsRead: jest.fn(),
  getUnreadCount: jest.fn(),
}));
jest.mock("../services/apiClient", () => ({
  errorMessage: (res: any, fallback: string) => res?.response?.data?.error || fallback,
  isApiError: (res: any) => !!res && res.isAxiosError === true,
}));

const now = new Date().toISOString();
const note = (id: string, type: string, data: any, extra: any = {}) => ({
  _id: id, type, actorName: "Ana Lee", projectName: "Relaunch", project: "p1", data, createdAt: now, ...extra,
});
const makeStore = (unread = 0) => configureStore({ reducer: rootReducer, preloadedState: { notificationReducer: { unread } } as any });
const renderWith = (ui: React.ReactElement, unread = 0) => {
  const store = makeStore(unread);
  render(
    <Provider store={store}>
      <MemoryRouter>{ui}</MemoryRouter>
    </Provider>
  );
  return store;
};

beforeEach(() => {
  mockNavigate.mockReset();
  (getNotifications as jest.Mock).mockReset();
  (markNotificationRead as jest.Mock).mockReset().mockResolvedValue({ ok: true });
  (markAllNotificationsRead as jest.Mock).mockReset();
});

describe("NotificationBell", () => {
  test("shows the unread count in the badge and in its accessible name", () => {
    renderWith(<NotificationBell />, 3);
    expect(screen.getByRole("button", { name: "Notifications, 3 unread" })).toBeInTheDocument();
    expect(screen.getByText("3")).toBeInTheDocument();
  });
  test("caps big counts and hides the badge at zero", () => {
    const { unmount } = render(
      <Provider store={makeStore(250)}>
        <MemoryRouter><NotificationBell /></MemoryRouter>
      </Provider>
    );
    expect(screen.getByText("99+")).toBeInTheDocument();
    unmount();
    renderWith(<NotificationBell />, 0);
    expect(screen.getByRole("button", { name: "Notifications" })).toBeInTheDocument();
    expect(screen.queryByText("0")).not.toBeInTheDocument();
  });
});

describe("NotificationsModal", () => {
  const page = (items: any[], extra: any = {}) => ({ items, nextCursor: null, unreadCount: items.filter((i) => !i.readAt).length, ...extra });

  test("renders notifications addressed to the recipient", async () => {
    (getNotifications as jest.Mock).mockResolvedValue(page([
      note("2", "task.created", { title: "Ship it", priority: "High" }, { task: "t1" }),
      note("1", "member.added", {}, { readAt: now }),
    ]));
    renderWith(<NotificationsModal setOpen={() => {}} />, 1);
    expect(await screen.findByText(/assigned you/)).toBeInTheDocument();
    expect(screen.getByText("Ship it")).toBeInTheDocument();
    expect(screen.getByText(/added you to/)).toBeInTheDocument();
    expect(screen.getAllByLabelText("Unread")).toHaveLength(1); // only the unread one has a dot
  });

  test("opening an unread item marks it read optimistically, updates the badge and navigates", async () => {
    (getNotifications as jest.Mock).mockResolvedValue(page([note("2", "task.created", { title: "Ship it" }, { task: "t1" })]));
    const setOpen = jest.fn();
    const store = renderWith(<NotificationsModal setOpen={setOpen} />, 1);
    fireEvent.click(await screen.findByText("Ship it"));
    expect(markNotificationRead).toHaveBeenCalledWith("2");
    expect(store.getState().notificationReducer.unread).toBe(0);
    expect(mockNavigate).toHaveBeenCalledWith("/task-page?id=t1");
    expect(setOpen).toHaveBeenCalledWith(false);
  });

  test("an item whose target is gone is marked read but stays open and does not navigate", async () => {
    (getNotifications as jest.Mock).mockResolvedValue(page([note("3", "task.deleted", { title: "Old task" }, { task: "t9" })]));
    const setOpen = jest.fn();
    renderWith(<NotificationsModal setOpen={setOpen} />, 1);
    fireEvent.click(await screen.findByText("Old task"));
    expect(markNotificationRead).toHaveBeenCalledWith("3");
    expect(mockNavigate).not.toHaveBeenCalled();
    expect(setOpen).not.toHaveBeenCalled();
  });

  test("'Mark all as read' clears every dot and zeroes the badge", async () => {
    (getNotifications as jest.Mock).mockResolvedValue(page([
      note("2", "task.created", { title: "A" }, { task: "a" }),
      note("1", "task.created", { title: "B" }, { task: "b" }),
    ]));
    (markAllNotificationsRead as jest.Mock).mockResolvedValue({ ok: true, updated: 2 });
    const store = renderWith(<NotificationsModal setOpen={() => {}} />, 2);
    await screen.findByText("A");
    fireEvent.click(screen.getByRole("button", { name: /mark all as read/i }));
    await waitFor(() => expect(screen.queryAllByLabelText("Unread")).toHaveLength(0));
    expect(store.getState().notificationReducer.unread).toBe(0);
    expect(screen.getByRole("button", { name: /mark all as read/i })).toBeDisabled();
  });

  test("the Unread filter asks the server for unread items and shows a friendly empty state", async () => {
    (getNotifications as jest.Mock)
      .mockResolvedValueOnce(page([note("1", "task.created", { title: "A" }, { readAt: now, task: "a" })]))
      .mockResolvedValueOnce(page([]));
    renderWith(<NotificationsModal setOpen={() => {}} />);
    await screen.findByText("A");
    fireEvent.click(screen.getByRole("button", { name: "Unread" }));
    expect(await screen.findByText("You're all caught up")).toBeInTheDocument();
    expect(getNotifications).toHaveBeenLastCalledWith(expect.objectContaining({ unread: true }));
  });

  test("'Load older' appends the next page; errors offer a working retry", async () => {
    (getNotifications as jest.Mock)
      .mockResolvedValueOnce(page([note("2", "task.created", { title: "Newer" }, { task: "a" })], { nextCursor: "2" }))
      .mockResolvedValueOnce(page([note("1", "task.created", { title: "Older" }, { task: "b" })]));
    renderWith(<NotificationsModal setOpen={() => {}} />);
    await screen.findByText("Newer");
    fireEvent.click(screen.getByRole("button", { name: /load older notifications/i }));
    expect(await screen.findByText("Older")).toBeInTheDocument();
    expect(getNotifications).toHaveBeenLastCalledWith(expect.objectContaining({ before: "2" }));
  });

  test("shows an error with a retry that recovers", async () => {
    (getNotifications as jest.Mock).mockResolvedValueOnce({ isAxiosError: true, response: { data: { error: "Boom" } } });
    renderWith(<NotificationsModal setOpen={() => {}} />);
    expect(await screen.findByRole("alert")).toHaveTextContent("Boom");
    (getNotifications as jest.Mock).mockResolvedValueOnce(page([note("1", "task.created", { title: "Back" }, { task: "a" })]));
    fireEvent.click(screen.getByRole("button", { name: "Retry" }));
    expect(await screen.findByText("Back")).toBeInTheDocument();
  });
});

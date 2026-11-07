import React from "react";
import { screen, fireEvent, waitFor, within } from "@testing-library/react";
import TaskDrawer from "./TaskDrawer";
import { qk } from "../queries/keys";
import { addCommentToTaskById, addSubtask, deleteSubtask, getTaskById, patchTask, updateSubtask } from "../services/taskServices";
import { getProjectActivity } from "../services/projectServices";
import { makeTestClient, makeTestStore, renderWithProviders } from "../testUtils";

jest.mock("../services/authServices", () => ({ getMe: jest.fn() }));
jest.mock("../services/notificationServices", () => ({ getNotifications: jest.fn(), getUnreadCount: jest.fn() }));
jest.mock("../services/userServices", () => ({ getAllUsers: jest.fn() }));
jest.mock("../services/projectServices", () => ({
  getProjectById: jest.fn(), getProjectRisk: jest.fn(), getProjectAnalytics: jest.fn(), getProjectActivity: jest.fn(),
}));
jest.mock("../services/taskServices", () => ({
  getTaskById: jest.fn(), patchTask: jest.fn(), addSubtask: jest.fn(), updateSubtask: jest.fn(), deleteSubtask: jest.fn(), addCommentToTaskById: jest.fn(),
}));
jest.mock("../services/apiClient", () => ({
  errorMessage: (res: any, fallback: string) => res?.response?.data?.error || fallback,
  isApiError: (res: any) => !!res && res.isAxiosError === true,
}));

const refused = { isAxiosError: true, response: { status: 403, data: { error: "You cannot edit this task" } } };
const person = (id: string, first: string) => ({ _id: id, firstName: first, lastName: "Test" });
const project = {
  _id: "p1",
  projectManager: person("boss", "Bo"),
  projectMembers: [person("boss", "Bo"), person("ann", "Ann"), person("cy", "Cy")],
};
const baseTask = () => ({
  _id: "t1",
  project: "p1",
  taskTitle: "Ship the thing",
  taskDescription: "Some **bold** text",
  taskPriority: "Medium",
  taskStatus: "In Progress",
  dueDate: "2026-12-01",
  estimateHours: 3,
  labels: ["bug"],
  assignedTo: person("ann", "Ann"),
  assignedBy: person("boss", "Bo"),
  subtasks: [{ _id: "s1", title: "Write tests", done: false }, { _id: "s2", title: "Deploy", done: true }],
  taskComments: [{ _id: "c1", senderName: "Bo Test", messageContent: "Looks good", timeStamp: "2026-11-01T10:00:00Z" }],
});

/** `as` is who is looking: "ann" assignee, "boss" manager/creator, "cy" a plain member. */
function renderDrawer(as: "ann" | "boss" | "cy" = "ann", task: any = baseTask(), onClose = jest.fn()) {
  (getTaskById as jest.Mock).mockResolvedValue(task);
  const utils = renderWithProviders(<TaskDrawer taskId="t1" project={project} me={{ _id: as }} onClose={onClose} />, {
    client: makeTestClient(),
    store: makeTestStore(true, { _id: as }),
  });
  return { ...utils, onClose };
}
const ready = () => screen.findByRole("heading", { name: /ship the thing/i });

beforeEach(() => {
  for (const fn of [getTaskById, patchTask, addSubtask, updateSubtask, deleteSubtask, addCommentToTaskById, getProjectActivity]) (fn as jest.Mock).mockReset();
  (patchTask as jest.Mock).mockResolvedValue({ editStatus: true });
  (getProjectActivity as jest.Mock).mockResolvedValue({ items: [], nextCursor: null });
});

describe("display", () => {
  test("shows the task's details, rendered Markdown, labels, sub-task progress and comments", async () => {
    renderDrawer();
    await ready();
    expect(screen.getByRole("dialog", { name: "Task: Ship the thing" })).toBeInTheDocument();
    expect(screen.getByText("bold").tagName).toBe("STRONG");
    expect(screen.getByLabelText("Status")).toHaveValue("In Progress");
    expect(screen.getByLabelText("Priority")).toHaveValue("Medium");
    expect(screen.getByLabelText("Due date")).toHaveValue("2026-12-01");
    expect(screen.getByLabelText("Estimate (hours)")).toHaveValue(3);
    expect(screen.getByText("bug")).toBeInTheDocument();
    expect(screen.getByText("1/2")).toBeInTheDocument();
    expect(screen.getByRole("progressbar", { name: /sub-task progress/i })).toHaveAttribute("aria-valuenow", "50");
    expect(screen.getByText("Looks good")).toBeInTheDocument();
    expect(screen.getByRole("tab", { name: "Comments (1)" })).toHaveAttribute("aria-selected", "true");
  });

  test("shows a loading state, then an error with a working retry", async () => {
    (getTaskById as jest.Mock).mockResolvedValueOnce({ isAxiosError: true, response: { status: 404, data: { error: "Task not found" } } });
    renderWithProviders(<TaskDrawer taskId="t1" project={project} me={{ _id: "ann" }} onClose={() => {}} />, { client: makeTestClient() });
    expect(screen.getByText(/loading task/i)).toBeInTheDocument();
    expect(await screen.findByRole("alert")).toHaveTextContent("Task not found");
    (getTaskById as jest.Mock).mockResolvedValueOnce(baseTask());
    fireEvent.click(screen.getByRole("button", { name: "Retry" }));
    await ready();
  });

  test("a task from a different project points to the right place instead of showing it here", async () => {
    renderDrawer("ann", { ...baseTask(), project: "other" });
    expect(await screen.findByText(/belongs to a different project/i)).toBeInTheDocument();
    expect(screen.getByRole("link", { name: /open it there/i })).toHaveAttribute("href", "/project-page?id=other&task=t1");
  });

  test("Close and Escape both close the drawer", async () => {
    const { onClose } = renderDrawer();
    await ready();
    fireEvent.click(screen.getByRole("button", { name: "Close" }));
    expect(onClose).toHaveBeenCalledTimes(1);
    fireEvent.keyDown(document, { key: "Escape" });
    expect(onClose).toHaveBeenCalledTimes(2);
  });
});

describe("permissions", () => {
  test("a plain member can read and comment but not edit anything", async () => {
    renderDrawer("cy");
    await ready();
    expect(screen.getByText(/view only/i)).toBeInTheDocument();
    for (const name of ["Status", "Priority", "Assignee", "Due date", "Estimate (hours)"]) expect(screen.getByLabelText(name)).toBeDisabled();
    expect(screen.queryByRole("button", { name: /edit description/i })).not.toBeInTheDocument();
    expect(screen.queryByLabelText("Add a label")).not.toBeInTheDocument();
    expect(screen.queryByLabelText("New sub-task")).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /remove label/i })).not.toBeInTheDocument();
    expect(screen.getByLabelText("Complete Write tests")).toBeDisabled();
    expect(screen.queryByTitle("Click to rename")).not.toBeInTheDocument();
    expect(screen.getByLabelText("Write a comment")).toBeEnabled();
  });

  test("the assignee can edit, but cannot reassign", async () => {
    renderDrawer("ann");
    await ready();
    expect(screen.getByLabelText("Priority")).toBeEnabled();
    expect(screen.getByLabelText("Assignee")).toBeDisabled();
  });

  test("the manager can reassign, choosing among the project's people", async () => {
    renderDrawer("boss");
    await ready();
    const select = screen.getByLabelText("Assignee");
    expect(select).toBeEnabled();
    expect(within(select).getAllByRole("option").map((o) => o.textContent)).toEqual(["Bo Test", "Ann Test", "Cy Test"]); // no duplicates
    fireEvent.change(select, { target: { value: "cy" } });
    await waitFor(() => expect(patchTask).toHaveBeenCalledWith("t1", { assignedTo: "cy" }));
  });
});

describe("inline editing", () => {
  test("renaming sends only the title; Escape cancels without saving and without closing the drawer", async () => {
    const { onClose } = renderDrawer();
    await ready();
    fireEvent.click(screen.getByTitle("Click to rename"));
    const input = screen.getByLabelText("Task title");
    fireEvent.change(input, { target: { value: "Ship it today" } });
    fireEvent.keyDown(input, { key: "Enter" });
    await waitFor(() => expect(patchTask).toHaveBeenCalledWith("t1", { taskTitle: "Ship it today" }));

    fireEvent.click(screen.getByTitle("Click to rename"));
    fireEvent.change(screen.getByLabelText("Task title"), { target: { value: "never saved" } });
    fireEvent.keyDown(screen.getByLabelText("Task title"), { key: "Escape" });
    expect(patchTask).toHaveBeenCalledTimes(1);
    expect(onClose).not.toHaveBeenCalled();
  });

  test("an empty or unchanged title is not saved", async () => {
    renderDrawer();
    await ready();
    fireEvent.click(screen.getByTitle("Click to rename"));
    fireEvent.change(screen.getByLabelText("Task title"), { target: { value: "   " } });
    fireEvent.keyDown(screen.getByLabelText("Task title"), { key: "Enter" });
    expect(patchTask).not.toHaveBeenCalled();
    expect(screen.getByRole("heading", { name: /ship the thing/i })).toBeInTheDocument();
  });

  test("status and priority save immediately; a refused change snaps back and explains why", async () => {
    renderDrawer();
    await ready();
    fireEvent.change(screen.getByLabelText("Priority"), { target: { value: "High" } });
    await waitFor(() => expect(patchTask).toHaveBeenCalledWith("t1", { taskPriority: "High" }));

    (patchTask as jest.Mock).mockResolvedValue(refused);
    fireEvent.change(screen.getByLabelText("Status"), { target: { value: "Completed" } });
    expect(await screen.findByRole("alert")).toHaveTextContent("You cannot edit this task");
    await waitFor(() => expect(screen.getByLabelText("Status")).toHaveValue("In Progress"));
  });

  test("the due date can be changed and cleared", async () => {
    renderDrawer();
    await ready();
    fireEvent.change(screen.getByLabelText("Due date"), { target: { value: "2026-12-24" } });
    await waitFor(() => expect(patchTask).toHaveBeenCalledWith("t1", { dueDate: "2026-12-24" }));
    fireEvent.change(screen.getByLabelText("Due date"), { target: { value: "" } });
    await waitFor(() => expect(patchTask).toHaveBeenLastCalledWith("t1", { dueDate: null }));
  });

  test("the estimate saves on blur, can be cleared, and rejects nonsense without calling the server", async () => {
    renderDrawer();
    await ready();
    const input = screen.getByLabelText("Estimate (hours)");
    fireEvent.change(input, { target: { value: "5.5" } });
    fireEvent.blur(input);
    await waitFor(() => expect(patchTask).toHaveBeenCalledWith("t1", { estimateHours: 5.5 }));
    fireEvent.change(input, { target: { value: "" } });
    fireEvent.blur(input);
    await waitFor(() => expect(patchTask).toHaveBeenLastCalledWith("t1", { estimateHours: null }));

    (patchTask as jest.Mock).mockClear();
    fireEvent.change(input, { target: { value: "5000" } });
    fireEvent.blur(input);
    expect(await screen.findByRole("alert")).toHaveTextContent(/between 0 and 1000/);
    expect(patchTask).not.toHaveBeenCalled();
  });

  test("REGRESSION: tabbing through the estimate right after the drawer loads never clears it", async () => {
    renderDrawer();
    const input = (await screen.findByLabelText("Estimate (hours)")) as HTMLInputElement;
    expect(input.value).toBe("3"); // correct from the very first paint, not synced in afterwards
    fireEvent.focus(input);
    fireEvent.blur(input);
    expect(patchTask).not.toHaveBeenCalled();
  });

  test("blurring the estimate without changing it does not save", async () => {
    renderDrawer();
    await ready();
    fireEvent.blur(screen.getByLabelText("Estimate (hours)"));
    expect(patchTask).not.toHaveBeenCalled();
  });
});

describe("labels", () => {
  test("adds a normalised label, and removes one", async () => {
    renderDrawer();
    await ready();
    const input = screen.getByLabelText("Add a label");
    fireEvent.change(input, { target: { value: "  Urgent " } });
    fireEvent.keyDown(input, { key: "Enter" });
    await waitFor(() => expect(patchTask).toHaveBeenCalledWith("t1", { labels: ["bug", "urgent"] }));
    fireEvent.click(screen.getByRole("button", { name: "Remove label bug" }));
    // builds on what is shown (bug + the label just added), so only "bug" goes
    await waitFor(() => expect(patchTask).toHaveBeenLastCalledWith("t1", { labels: ["urgent"] }));
  });

  test("an invalid label is explained and never sent; a duplicate is ignored quietly", async () => {
    renderDrawer();
    await ready();
    const input = screen.getByLabelText("Add a label");
    fireEvent.change(input, { target: { value: "<b>" } });
    fireEvent.keyDown(input, { key: "Enter" });
    expect(screen.getByRole("alert")).toHaveTextContent(/letters, numbers/);
    fireEvent.change(input, { target: { value: "BUG" } });
    fireEvent.keyDown(input, { key: "Enter" });
    expect(patchTask).not.toHaveBeenCalled();
  });
});

describe("description", () => {
  test("edit, preview and save", async () => {
    renderDrawer();
    await ready();
    fireEvent.click(screen.getByRole("button", { name: /edit description/i }));
    const box = screen.getByRole("textbox", { name: "Description" });
    expect(box).toHaveValue("Some **bold** text");
    fireEvent.change(box, { target: { value: "# Plan\n- one\n- two" } });
    fireEvent.click(screen.getByRole("button", { name: "Preview" }));
    expect(screen.getByRole("heading", { name: "Plan" })).toBeInTheDocument();
    expect(screen.getByText("one").tagName).toBe("SPAN"); // the previewed bullets
    expect(screen.getByText("one").closest("ul")).toHaveClass("list-disc");
    expect(screen.getByText("two")).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Save" }));
    await waitFor(() => expect(patchTask).toHaveBeenCalledWith("t1", { taskDescription: "# Plan\n- one\n- two" }));
  });

  test("a refused save keeps the editor open with the text intact", async () => {
    (patchTask as jest.Mock).mockResolvedValue(refused);
    renderDrawer();
    await ready();
    fireEvent.click(screen.getByRole("button", { name: /edit description/i }));
    fireEvent.change(screen.getByRole("textbox", { name: "Description" }), { target: { value: "precious words" } });
    fireEvent.click(screen.getByRole("button", { name: "Save" }));
    expect(await screen.findByRole("alert")).toHaveTextContent("You cannot edit this task");
    expect(screen.getByRole("textbox", { name: "Description" })).toHaveValue("precious words");
  });

  test("Escape cancels the edit only; Ctrl+Enter saves", async () => {
    const { onClose } = renderDrawer();
    await ready();
    fireEvent.click(screen.getByRole("button", { name: /edit description/i }));
    fireEvent.change(screen.getByRole("textbox", { name: "Description" }), { target: { value: "draft" } });
    fireEvent.keyDown(screen.getByRole("textbox", { name: "Description" }), { key: "Escape" });
    expect(screen.queryByRole("textbox", { name: "Description" })).not.toBeInTheDocument();
    expect(onClose).not.toHaveBeenCalled();
    expect(patchTask).not.toHaveBeenCalled();

    fireEvent.click(screen.getByRole("button", { name: /edit description/i }));
    fireEvent.change(screen.getByRole("textbox", { name: "Description" }), { target: { value: "via keyboard" } });
    fireEvent.keyDown(screen.getByRole("textbox", { name: "Description" }), { key: "Enter", ctrlKey: true });
    await waitFor(() => expect(patchTask).toHaveBeenCalledWith("t1", { taskDescription: "via keyboard" }));
  });

  test("unchanged text is not sent, and an empty description invites writing one", async () => {
    renderDrawer("ann", { ...baseTask(), taskDescription: "" });
    await ready();
    expect(screen.getByText("No description yet.")).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: /add a description/i }));
    fireEvent.click(screen.getByRole("button", { name: "Save" }));
    expect(patchTask).not.toHaveBeenCalled();
  });

  test("hostile Markdown is shown as text, never executed", async () => {
    renderDrawer("ann", { ...baseTask(), taskDescription: '<img src=x onerror="window.__pwned=1">\n[x](javascript:alert(1))' });
    await ready();
    expect(document.querySelector("img")).toBeNull();
    expect(document.querySelector("a[href^=javascript]")).toBeNull();
    expect(screen.getByText(/<img src=x/)).toBeInTheDocument();
  });
});

describe("sub-tasks", () => {
  test("ticking one updates the cache immediately, before the server answers", async () => {
    let resolve!: (v: any) => void;
    (updateSubtask as jest.Mock).mockReturnValue(new Promise((r) => (resolve = r)));
    const { client } = renderDrawer();
    await ready();
    fireEvent.click(screen.getByLabelText("Complete Write tests"));
    await waitFor(() => expect((client.getQueryData(qk.task("t1")) as any).subtasks[0].done).toBe(true));
    expect(updateSubtask).toHaveBeenCalledWith("t1", "s1", { done: true });
    expect(await screen.findByText("2/2")).toBeInTheDocument();
    resolve({ subtasks: [{ _id: "s1", title: "Write tests", done: true }, { _id: "s2", title: "Deploy", done: true }] });
  });

  test("a refused tick is undone by refetching the truth, with an explanation", async () => {
    (updateSubtask as jest.Mock).mockResolvedValue(refused);
    renderDrawer();
    await ready();
    fireEvent.click(screen.getByLabelText("Complete Write tests"));
    expect(await screen.findByRole("alert")).toHaveTextContent("You cannot edit this task");
    await waitFor(() => expect(getTaskById).toHaveBeenCalledTimes(2)); // refetched
  });

  test("adds and removes sub-tasks", async () => {
    (addSubtask as jest.Mock).mockResolvedValue({ subtasks: [] });
    (deleteSubtask as jest.Mock).mockResolvedValue({ subtasks: [] });
    renderDrawer();
    await ready();
    fireEvent.change(screen.getByLabelText("New sub-task"), { target: { value: "  Announce it " } });
    fireEvent.click(screen.getByRole("button", { name: "Add" }));
    await waitFor(() => expect(addSubtask).toHaveBeenCalledWith("t1", "Announce it"));
    await waitFor(() => expect(screen.getByLabelText("New sub-task")).toHaveValue(""));
    fireEvent.click(screen.getByRole("button", { name: "Remove sub-task Deploy" }));
    await waitFor(() => expect(deleteSubtask).toHaveBeenCalledWith("t1", "s2"));
  });

  test("a blank sub-task is not sent", async () => {
    renderDrawer();
    await ready();
    expect(screen.getByRole("button", { name: "Add" })).toBeDisabled();
    expect(addSubtask).not.toHaveBeenCalled();
  });

  test("a failed add keeps the text and explains", async () => {
    (addSubtask as jest.Mock).mockResolvedValue({ isAxiosError: true, response: { data: { error: "A task can have at most 50 sub-tasks" } } });
    renderDrawer();
    await ready();
    fireEvent.change(screen.getByLabelText("New sub-task"), { target: { value: "one more" } });
    fireEvent.click(screen.getByRole("button", { name: "Add" }));
    expect(await screen.findByRole("alert")).toHaveTextContent("at most 50");
    expect(screen.getByLabelText("New sub-task")).toHaveValue("one more");
  });
});

describe("comments and history", () => {
  test("posts a comment; empty comments are refused locally", async () => {
    (addCommentToTaskById as jest.Mock).mockResolvedValue({ addStatus: true });
    renderDrawer("cy");
    await ready();
    fireEvent.click(screen.getByRole("button", { name: "Comment" }));
    expect(screen.getByRole("alert")).toHaveTextContent("Cannot post an empty comment");
    expect(addCommentToTaskById).not.toHaveBeenCalled();
    fireEvent.change(screen.getByLabelText("Write a comment"), { target: { value: "On it" } });
    fireEvent.click(screen.getByRole("button", { name: "Comment" }));
    await waitFor(() => expect(addCommentToTaskById).toHaveBeenCalledWith("t1", { messageContent: "On it" }));
    await waitFor(() => expect(screen.getByLabelText("Write a comment")).toHaveValue(""));
  });

  test("a failed comment keeps the text", async () => {
    (addCommentToTaskById as jest.Mock).mockResolvedValue({ isAxiosError: true, response: { data: { error: "Nope" } } });
    renderDrawer("cy");
    await ready();
    fireEvent.change(screen.getByLabelText("Write a comment"), { target: { value: "keep me" } });
    fireEvent.click(screen.getByRole("button", { name: "Comment" }));
    expect(await screen.findByRole("alert")).toHaveTextContent("Nope");
    expect(screen.getByLabelText("Write a comment")).toHaveValue("keep me");
  });

  test("the History tab loads this task's own events", async () => {
    (getProjectActivity as jest.Mock).mockResolvedValue({
      items: [{ _id: "a1", verb: "task.status_changed", actorName: "Ann Test", data: { title: "Ship the thing", from: "To Do", to: "In Progress" }, createdAt: new Date().toISOString() }],
      nextCursor: null,
    });
    renderDrawer();
    await ready();
    fireEvent.click(screen.getByRole("tab", { name: /history/i }));
    expect(await screen.findByText(/from To Do to In Progress/)).toBeInTheDocument();
    expect(getProjectActivity).toHaveBeenCalledWith("p1", { limit: 20, task: "t1" });
  });

  test("an empty history says so", async () => {
    renderDrawer();
    await ready();
    fireEvent.click(screen.getByRole("tab", { name: /history/i }));
    expect(await screen.findByText("No history yet.")).toBeInTheDocument();
  });
});

test("the dialog has a name from the start, even while the task is still loading", () => {
  (getTaskById as jest.Mock).mockReturnValue(new Promise(() => {})); // never resolves
  renderWithProviders(<TaskDrawer taskId="t1" project={project} me={{ _id: "ann" }} onClose={() => {}} />);
  expect(screen.getByRole("dialog", { name: "Task details" })).toBeInTheDocument();
});

describe("typing while a save is still in flight (regressions found by driving the UI quickly)", () => {
  test("a second sub-task typed while the first is saving is kept and sent", async () => {
    let first!: (v: any) => void;
    (addSubtask as jest.Mock).mockReturnValueOnce(new Promise((r) => (first = r))).mockResolvedValueOnce({ subtasks: [] });
    renderDrawer();
    await ready();
    const box = screen.getByLabelText("New sub-task");
    fireEvent.change(box, { target: { value: "one" } });
    fireEvent.click(screen.getByRole("button", { name: "Add" }));
    expect(box).toHaveValue(""); // cleared at once, ready for the next
    fireEvent.change(box, { target: { value: "two" } });
    fireEvent.click(screen.getByRole("button", { name: "Add" }));
    expect(addSubtask).toHaveBeenNthCalledWith(1, "t1", "one");
    expect(addSubtask).toHaveBeenNthCalledWith(2, "t1", "two");
    first({ subtasks: [] });
  });

  test("text typed while a comment is posting is not wiped when the post finishes", async () => {
    let post!: (v: any) => void;
    (addCommentToTaskById as jest.Mock).mockReturnValue(new Promise((r) => (post = r)));
    renderDrawer("cy");
    await ready();
    const box = screen.getByLabelText("Write a comment");
    fireEvent.change(box, { target: { value: "first" } });
    fireEvent.click(screen.getByRole("button", { name: "Comment" }));
    expect(box).toHaveValue("");
    fireEvent.change(box, { target: { value: "second thought" } });
    post({ addStatus: true });
    await waitFor(() => expect(screen.getByRole("button", { name: "Comment" })).toBeEnabled());
    expect(box).toHaveValue("second thought");
  });

  test("a failed sub-task add gives the text back only if the box is still empty", async () => {
    let first!: (v: any) => void;
    (addSubtask as jest.Mock).mockReturnValueOnce(new Promise((r) => (first = r)));
    renderDrawer();
    await ready();
    const box = screen.getByLabelText("New sub-task");
    fireEvent.change(box, { target: { value: "lost cause" } });
    fireEvent.click(screen.getByRole("button", { name: "Add" }));
    fireEvent.change(box, { target: { value: "already typing" } });
    first({ isAxiosError: true, response: { data: { error: "no" } } });
    expect(await screen.findByRole("alert")).toHaveTextContent("no");
    expect(box).toHaveValue("already typing"); // not overwritten
  });
});

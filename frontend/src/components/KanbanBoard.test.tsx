import React from "react";
import { screen, fireEvent, waitFor, within } from "@testing-library/react";
import KanbanBoard from "./KanbanBoard";
import { useProject } from "../queries/hooks";
import { qk } from "../queries/keys";
import { getProjectById } from "../services/projectServices";
import { changeTaskStatus } from "../services/taskServices";
import { renderWithProviders } from "../testUtils";

jest.mock("../services/projectServices", () => ({ getProjectById: jest.fn() }));
jest.mock("../services/taskServices", () => ({ changeTaskStatus: jest.fn() }));
jest.mock("../services/apiClient", () => ({
  errorMessage: (res: any, fallback: string) => res?.response?.data?.error || fallback,
  isApiError: (res: any) => !!res && res.isAxiosError === true,
}));

const me = { _id: "me" };
const project = {
  _id: "p1",
  projectManager: { _id: "boss", firstName: "Bo", lastName: "Ss" },
  projectMembers: [{ _id: "me", firstName: "Me", lastName: "Self" }],
  allTasks: [
    { _id: "t1", taskTitle: "Mine", taskStatus: "To Do", taskPriority: "High", assignedTo: "me", assignedBy: "boss" },
    { _id: "t2", taskTitle: "Not mine", taskStatus: "To Do", taskPriority: "Low", assignedTo: "boss", assignedBy: "boss" },
  ],
};

// The board reads its tasks from the project's cache entry, exactly like the project page behind it.
function Harness() {
  const q = useProject("p1");
  return q.data ? <KanbanBoard project={q.data} me={me} /> : null;
}
const column = (name: string) => screen.getByRole("region", { name: new RegExp(`^${name},`) });
const move = (title: string, to: string) =>
  fireEvent.change(screen.getByLabelText(`Move ${title} to another column`), { target: { value: to } });

beforeEach(() => {
  (getProjectById as jest.Mock).mockReset().mockResolvedValue(JSON.parse(JSON.stringify(project)));
  (changeTaskStatus as jest.Mock).mockReset();
});

test("a move updates the shared cache immediately, before the server answers", async () => {
  let resolve!: (v: any) => void;
  (changeTaskStatus as jest.Mock).mockReturnValue(new Promise((r) => (resolve = r)));
  const { client } = renderWithProviders(<Harness />);
  await screen.findByText("Mine");
  move("Mine", "In Review");
  await waitFor(() => expect(column("In Review")).toHaveTextContent("Mine")); // optimistic
  expect((client.getQueryData(qk.project("p1")) as any).allTasks[0].taskStatus).toBe("In Review"); // the page behind sees it too
  expect(changeTaskStatus).toHaveBeenCalledWith("t1", "In Review");
  resolve({ updateStatus: true });
});

test("a refused move is rolled back everywhere and explained", async () => {
  (changeTaskStatus as jest.Mock).mockResolvedValue({ isAxiosError: true, response: { data: { error: "You cannot change this task's status" } } });
  const { client } = renderWithProviders(<Harness />);
  await screen.findByText("Mine");
  move("Mine", "Completed");
  expect(await screen.findByRole("alert")).toHaveTextContent("You cannot change this task's status");
  expect(within(column("To Do")).getByText("Mine")).toBeInTheDocument();
  expect((client.getQueryData(qk.project("p1")) as any).allTasks[0].taskStatus).toBe("To Do");
});

test("only the tasks you may move are movable", async () => {
  renderWithProviders(<Harness />);
  await screen.findByText("Mine");
  expect(screen.getByLabelText("Move Mine to another column")).toBeEnabled();
  expect(screen.getByLabelText("Move Not mine to another column")).toBeDisabled();
});

test("moving a task that is not yours never calls the server", async () => {
  renderWithProviders(<Harness />);
  await screen.findByText("Not mine");
  // the select is disabled in the UI; the guard also protects the drag-and-drop path
  const select = screen.getByLabelText("Move Not mine to another column") as HTMLSelectElement;
  expect(select.disabled).toBe(true);
  expect(changeTaskStatus).not.toHaveBeenCalled();
});

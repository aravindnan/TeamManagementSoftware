// Regression tests: services resolve with an error object instead of throwing, so every modal must
// branch on the response. These used to report success (or hang on "loading") when a request failed.
import React from "react";
import { screen, fireEvent, waitFor } from "@testing-library/react";
import { renderWithProviders, makeTestStore } from "../testUtils";
import DeleteTaskConfirmationModal from "./DeleteTaskConfirmationModal";
import ChangeStatusModal from "./ChangeStatusModal";
import AddNewMemberModal from "./AddNewMemberModal";
import { deleteTaskById, changeTaskStatus } from "../services/taskServices";
import { addMemberToProject } from "../services/projectServices";
import { getAllUsers } from "../services/userServices";

jest.mock("../services/taskServices", () => ({ deleteTaskById: jest.fn(), changeTaskStatus: jest.fn() }));
jest.mock("../services/projectServices", () => ({ addMemberToProject: jest.fn() }));
jest.mock("../services/userServices", () => ({ getAllUsers: jest.fn() }));
jest.mock("../services/apiClient", () => ({
  errorMessage: (res: any, fallback: string) => res?.response?.data?.error || fallback,
  isApiError: (res: any) => !!res && res.isAxiosError === true,
}));

const failure = { isAxiosError: true, response: { status: 403, data: { error: "Nope" } } };
const wrap = (ui: React.ReactElement) => renderWithProviders(ui, { store: makeTestStore(true, { _id: "me" }) });

beforeEach(() => {
  (deleteTaskById as jest.Mock).mockReset();
  (changeTaskStatus as jest.Mock).mockReset();
  (addMemberToProject as jest.Mock).mockReset();
  (getAllUsers as jest.Mock).mockReset();
});

describe("DeleteTaskConfirmationModal", () => {
  const renderIt = () => wrap(<DeleteTaskConfirmationModal activeTask={{ _id: "t1" }} setDeleteTaskModal={() => {}} />);

  test("a failed delete shows the failure, instead of hanging", async () => {
    (deleteTaskById as jest.Mock).mockResolvedValue(failure);
    renderIt();
    fireEvent.click(screen.getByRole("button", { name: "Delete" }));
    expect(await screen.findByText("Deletion Failed")).toBeInTheDocument();
  });

  test("a successful delete shows success", async () => {
    (deleteTaskById as jest.Mock).mockResolvedValue({ deleteStatus: true });
    renderIt();
    fireEvent.click(screen.getByRole("button", { name: "Delete" }));
    expect(await screen.findByText("Task Deleted")).toBeInTheDocument();
  });
});

describe("ChangeStatusModal", () => {
  test.each([
    ["Completed", "In Progress"],
    ["In Review", "Completed"],
    ["To Do", "Completed"],
  ])("a %s task is changed to %s", async (from, to) => {
    (changeTaskStatus as jest.Mock).mockResolvedValue({ updateStatus: true });
    wrap(<ChangeStatusModal activeTask={{ _id: "t1", taskStatus: from }} setTaskStatusModal={() => {}} />);
    fireEvent.click(screen.getByRole("button", { name: "Update" }));
    await waitFor(() => expect(changeTaskStatus).toHaveBeenCalledWith("t1", to));
  });

  test("a failed update shows the failure", async () => {
    (changeTaskStatus as jest.Mock).mockResolvedValue(failure);
    wrap(<ChangeStatusModal activeTask={{ _id: "t1", taskStatus: "To Do" }} setTaskStatusModal={() => {}} />);
    fireEvent.click(screen.getByRole("button", { name: "Update" }));
    expect(await screen.findByText("Updation Failed")).toBeInTheDocument();
    expect(screen.queryByText("Task Status Updated")).not.toBeInTheDocument();
  });

  test("re-rendering with a refetched task does not flip the target (the old effect did)", async () => {
    (changeTaskStatus as jest.Mock).mockResolvedValue({ updateStatus: true });
    const props = { setTaskStatusModal: () => {} };
    const { rerender } = wrap(<ChangeStatusModal activeTask={{ _id: "t1", taskStatus: "To Do" }} {...props} />);
    rerender(<ChangeStatusModal activeTask={{ _id: "t1", taskStatus: "To Do" }} {...props} />);
    fireEvent.click(screen.getByRole("button", { name: "Update" }));
    await waitFor(() => expect(changeTaskStatus).toHaveBeenCalledWith("t1", "Completed"));
  });
});

describe("AddNewMemberModal", () => {
  const project = { _id: "p1", projectMembers: [{ _id: "me" }, { _id: "u1" }] };
  const users = [
    { _id: "me", firstName: "Me", lastName: "Self" },
    { _id: "u1", firstName: "Ann", lastName: "Member" },
    { _id: "u2", firstName: "Bo", lastName: "Newcomer" },
  ];
  const renderIt = () => wrap(<AddNewMemberModal activeProject={project} setAddMemberModal={() => {}} />);
  const pick = async (id: string) => {
    const select = await screen.findByRole("combobox");
    fireEvent.change(select, { target: { value: id } });
    fireEvent.click(screen.getByRole("button", { name: "Add" }));
  };

  test("only offers people who are not already on the project", async () => {
    (getAllUsers as jest.Mock).mockResolvedValue(users);
    renderIt();
    expect(await screen.findByRole("option", { name: "Bo Newcomer" })).toBeInTheDocument();
    expect(screen.queryByRole("option", { name: "Ann Member" })).not.toBeInTheDocument();
    expect(screen.queryByRole("option", { name: "Me Self" })).not.toBeInTheDocument();
  });

  test("a failed add shows failure and does not claim success", async () => {
    (getAllUsers as jest.Mock).mockResolvedValue(users);
    (addMemberToProject as jest.Mock).mockResolvedValue(failure);
    renderIt();
    await pick("u2");
    expect(await screen.findByText("Failed To Add Member")).toBeInTheDocument();
    expect(screen.queryByText("Memeber Added to Project")).not.toBeInTheDocument();
  });

  test("a successful add shows success", async () => {
    (getAllUsers as jest.Mock).mockResolvedValue(users);
    (addMemberToProject as jest.Mock).mockResolvedValue({ project: { _id: "p1" } });
    renderIt();
    await pick("u2");
    expect(await screen.findByText("Memeber Added to Project")).toBeInTheDocument();
    expect(addMemberToProject).toHaveBeenCalledWith("p1", { memberId: "u2" });
  });

  test("a failed user lookup shows an error and stops loading instead of crashing or hanging", async () => {
    (getAllUsers as jest.Mock).mockResolvedValue(failure);
    renderIt();
    expect(await screen.findByText(/could not load users/i)).toBeInTheDocument();
    expect(screen.queryByText("Loading All Users...")).not.toBeInTheDocument();
  });
});

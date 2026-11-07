// Regression tests: services resolve with an error object instead of throwing, so every modal must
// branch on the response. These used to report success (or hang on "loading") when a request failed.
import React from "react";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import { Provider } from "react-redux";
import { configureStore } from "@reduxjs/toolkit";
import { MemoryRouter } from "react-router-dom";
import { rootReducer } from "../redux/rootReducer";
import DeleteTaskConfirmationModal from "./DeleteTaskConfirmationModal";
import ChangeStatusModal from "./ChangeStatusModal";
import AddNewMemberModal from "./AddNewMemberModal";
import { deleteTaskById, changeTaskStatus } from "../services/taskServices";
import { addMemberToProject } from "../services/projectServices";
import { getAllUsers } from "../services/userServices";

jest.mock("../services/taskServices", () => ({ deleteTaskById: jest.fn(), changeTaskStatus: jest.fn() }));
jest.mock("../services/projectServices", () => ({ addMemberToProject: jest.fn() }));
jest.mock("../services/userServices", () => ({ getAllUsers: jest.fn() }));

const failure = { isAxiosError: true, response: { status: 403, data: { error: "Nope" } } };
const store = () =>
  configureStore({
    reducer: rootReducer,
    preloadedState: { authReducer: { myUserProfile: { _id: "me" }, isAuthenticated: true } } as any,
  });
const wrap = (ui: React.ReactElement) =>
  render(
    <Provider store={store()}>
      <MemoryRouter>{ui}</MemoryRouter>
    </Provider>
  );

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
    wrap(<ChangeStatusModal activeTask={{ _id: "t1", taskStatus: from }} setTaskStatusModal={() => {}} triggerRerender={() => {}} />);
    fireEvent.click(screen.getByRole("button", { name: "Update" }));
    await waitFor(() => expect(changeTaskStatus).toHaveBeenCalledWith("t1", to));
  });

  test("a failed update shows the failure and does not refresh the page data", async () => {
    (changeTaskStatus as jest.Mock).mockResolvedValue(failure);
    const triggerRerender = jest.fn();
    wrap(<ChangeStatusModal activeTask={{ _id: "t1", taskStatus: "To Do" }} setTaskStatusModal={() => {}} triggerRerender={triggerRerender} />);
    fireEvent.click(screen.getByRole("button", { name: "Update" }));
    expect(await screen.findByText("Updation Failed")).toBeInTheDocument();
    expect(triggerRerender).not.toHaveBeenCalled();
  });

  test("re-rendering with a refetched task does not flip the target (the old effect did)", async () => {
    (changeTaskStatus as jest.Mock).mockResolvedValue({ updateStatus: true });
    const props = { setTaskStatusModal: () => {}, triggerRerender: () => {} };
    const { rerender } = render(
      <Provider store={store()}><MemoryRouter><ChangeStatusModal activeTask={{ _id: "t1", taskStatus: "To Do" }} {...props} /></MemoryRouter></Provider>
    );
    rerender(
      <Provider store={store()}><MemoryRouter><ChangeStatusModal activeTask={{ _id: "t1", taskStatus: "To Do" }} {...props} /></MemoryRouter></Provider>
    );
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
  const renderIt = (triggerRerender = jest.fn()) => {
    wrap(<AddNewMemberModal activeProject={project} setAddMemberModal={() => {}} triggerRerender={triggerRerender} />);
    return triggerRerender;
  };
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

  test("a failed add shows failure and does not claim success or refresh", async () => {
    (getAllUsers as jest.Mock).mockResolvedValue(users);
    (addMemberToProject as jest.Mock).mockResolvedValue(failure);
    const triggerRerender = renderIt();
    await pick("u2");
    expect(await screen.findByText("Failed To Add Member")).toBeInTheDocument();
    expect(screen.queryByText("Memeber Added to Project")).not.toBeInTheDocument();
    expect(triggerRerender).not.toHaveBeenCalled();
  });

  test("a successful add shows success and refreshes", async () => {
    (getAllUsers as jest.Mock).mockResolvedValue(users);
    (addMemberToProject as jest.Mock).mockResolvedValue({ project: { _id: "p1" } });
    const triggerRerender = renderIt();
    await pick("u2");
    expect(await screen.findByText("Memeber Added to Project")).toBeInTheDocument();
    expect(triggerRerender).toHaveBeenCalled();
  });

  test("a failed user lookup shows an error and stops loading instead of crashing or hanging", async () => {
    (getAllUsers as jest.Mock).mockResolvedValue(failure);
    renderIt();
    expect(await screen.findByText(/could not load users/i)).toBeInTheDocument();
    expect(screen.queryByText("Loading All Users...")).not.toBeInTheDocument();
  });
});

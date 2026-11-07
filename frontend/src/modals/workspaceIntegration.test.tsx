import React from "react";
import { screen, fireEvent, waitFor, within } from "@testing-library/react";
import CreateNewProjectModal from "./CreateNewProjectModal";
import AddNewMemberModal from "./AddNewMemberModal";
import { createNewProject } from "../services/projectServices";
import { getAllUsers } from "../services/userServices";
import { getWorkspace, getWorkspaces } from "../services/workspaceServices";
import { addMemberToProject } from "../services/projectServices";
import { makeTestStore, renderWithProviders } from "../testUtils";

jest.mock("../services/authServices", () => ({ getMe: jest.fn() }));
jest.mock("../services/notificationServices", () => ({ getNotifications: jest.fn(), getUnreadCount: jest.fn() }));
jest.mock("../services/projectServices", () => ({ createNewProject: jest.fn(), addMemberToProject: jest.fn() }));
jest.mock("../services/taskServices", () => ({}));
jest.mock("../services/userServices", () => ({ getAllUsers: jest.fn() }));
jest.mock("../services/workspaceServices", () => ({ getWorkspaces: jest.fn(), getWorkspace: jest.fn(), getWorkspaceInvites: jest.fn(), getMyInvites: jest.fn(), previewInvite: jest.fn() }));
jest.mock("../services/apiClient", () => ({
  errorMessage: (res: any, fallback: string) => res?.response?.data?.error || fallback,
  isApiError: (res: any) => !!res && res.isAxiosError === true,
}));

const store = () => makeTestStore(true, { _id: "me", firstName: "Me", lastName: "Self" });
const workspaces = [
  { _id: "w1", name: "Acme Co", myRole: "owner", memberCount: 3, projectCount: 0 },
  { _id: "w2", name: "Side Gig", myRole: "member", memberCount: 2, projectCount: 1 },
];

beforeEach(() => {
  for (const fn of [createNewProject, addMemberToProject, getAllUsers, getWorkspaces, getWorkspace]) (fn as jest.Mock).mockReset();
});

describe("creating a project inside a workspace", () => {
  const renderModal = (props: any = {}) => renderWithProviders(<CreateNewProjectModal setCreateNewProjectModal={() => {}} {...props} />, { store: store() });
  const fill = () => {
    fireEvent.change(document.getElementById("projectName") as HTMLInputElement, { target: { name: "projectName", value: "Launch" } });
    fireEvent.change(document.getElementById("projectDescription") as HTMLTextAreaElement, { target: { name: "projectDescription", value: "Ship it" } });
  };

  test("defaults to the first workspace and sends its id with the project", async () => {
    (getWorkspaces as jest.Mock).mockResolvedValue(workspaces);
    (createNewProject as jest.Mock).mockResolvedValue({ project: { _id: "p1" } });
    renderModal();
    const select = await screen.findByLabelText("Workspace");
    expect(select).toHaveValue("w1");
    expect(within(select).getAllByRole("option").map((o) => o.textContent)).toEqual(["Acme Co", "Side Gig"]);
    fill();
    fireEvent.click(screen.getByRole("button", { name: /save/i }));
    await waitFor(() => expect(createNewProject).toHaveBeenCalledWith(expect.objectContaining({ projectName: "Launch", workspaceId: "w1" }), "me"));
  });

  test("starts on the workspace being viewed on the dashboard, and lets you change it", async () => {
    (getWorkspaces as jest.Mock).mockResolvedValue(workspaces);
    (createNewProject as jest.Mock).mockResolvedValue({ project: { _id: "p1" } });
    renderModal({ defaultWorkspaceId: "w2" });
    const select = await screen.findByLabelText("Workspace");
    expect(select).toHaveValue("w2");
    fireEvent.change(select, { target: { value: "w1" } });
    fill();
    fireEvent.click(screen.getByRole("button", { name: /save/i }));
    await waitFor(() => expect(createNewProject).toHaveBeenCalledWith(expect.objectContaining({ workspaceId: "w1" }), "me"));
  });

  test("with no workspace it explains what to do and cannot be submitted", async () => {
    (getWorkspaces as jest.Mock).mockResolvedValue([]);
    renderModal();
    expect(await screen.findByText(/create a workspace first/i)).toBeInTheDocument();
    expect(screen.queryByLabelText("Workspace")).not.toBeInTheDocument();
    fill();
    expect(screen.getByRole("button", { name: /save/i })).toBeDisabled();
    expect(createNewProject).not.toHaveBeenCalled();
  });

  test("a server refusal is shown instead of claiming success", async () => {
    (getWorkspaces as jest.Mock).mockResolvedValue(workspaces);
    (createNewProject as jest.Mock).mockResolvedValue({ isAxiosError: true, response: { data: { error: "You are not a member of that workspace" } } });
    renderModal();
    await screen.findByLabelText("Workspace");
    fill();
    fireEvent.click(screen.getByRole("button", { name: /save/i }));
    expect(await screen.findByText("You are not a member of that workspace")).toBeInTheDocument();
    expect(screen.queryByText("Project Created")).not.toBeInTheDocument();
  });
});

describe("adding a member to a project", () => {
  const people = [
    { _id: "me", firstName: "Me", lastName: "Self" },
    { _id: "u1", firstName: "Ann", lastName: "Already" },
    { _id: "u2", firstName: "Bo", lastName: "Newcomer" },
  ];
  const project = (extra: any = {}) => ({ _id: "p1", projectMembers: [{ _id: "me" }, { _id: "u1" }], ...extra });
  const renderModal = (activeProject: any) =>
    renderWithProviders(<AddNewMemberModal activeProject={activeProject} setAddMemberModal={() => {}} />, { store: store() });

  test("for a workspace project, offers only that workspace's people who are not yet on the project", async () => {
    (getWorkspace as jest.Mock).mockResolvedValue({ _id: "w1", members: people.map((user) => ({ user, role: "member" })) });
    renderModal(project({ workspace: { _id: "w1", name: "Acme Co" } }));
    expect(await screen.findByRole("option", { name: "Bo Newcomer" })).toBeInTheDocument();
    expect(screen.queryByRole("option", { name: "Ann Already" })).not.toBeInTheDocument();
    expect(screen.queryByRole("option", { name: "Me Self" })).not.toBeInTheDocument();
    expect(screen.getByText(/only people in the acme co workspace can be added/i)).toBeInTheDocument();
    expect(getAllUsers).not.toHaveBeenCalled(); // the global directory is not used for workspace projects
  });

  test("for an older project without a workspace, falls back to the people you share projects with", async () => {
    (getAllUsers as jest.Mock).mockResolvedValue(people);
    renderModal(project());
    expect(await screen.findByRole("option", { name: "Bo Newcomer" })).toBeInTheDocument();
    expect(getWorkspace).not.toHaveBeenCalled();
    expect(screen.queryByText(/only people in the/i)).not.toBeInTheDocument();
  });

  test("if the workspace cannot be loaded it says so instead of hanging", async () => {
    (getWorkspace as jest.Mock).mockResolvedValue({ isAxiosError: true, response: { status: 404, data: { error: "Workspace not found" } } });
    renderModal(project({ workspace: { _id: "w1", name: "Acme Co" } }));
    expect(await screen.findByText(/could not load users/i)).toBeInTheDocument();
    expect(screen.queryByText("Loading All Users...")).not.toBeInTheDocument();
  });
});

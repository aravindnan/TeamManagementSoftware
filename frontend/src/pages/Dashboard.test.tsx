import React from "react";
import { screen, fireEvent, waitFor, within, act } from "@testing-library/react";
import Dashboard from "./Dashboard";
import { getMe } from "../services/authServices";
import * as ws from "../services/workspaceServices";
import { qk } from "../queries/keys";
import { renderWithProviders, makeTestClient, makeTestStore } from "../testUtils";

jest.mock("../services/authServices", () => ({ getMe: jest.fn(), logoutUser: jest.fn() }));
jest.mock("../services/workspaceServices");
jest.mock("../services/notificationServices", () => ({ getNotifications: jest.fn(), getUnreadCount: jest.fn().mockResolvedValue({ count: 0 }) }));
jest.mock("../services/projectServices", () => ({ createNewProject: jest.fn() }));
jest.mock("../services/taskServices", () => ({}));
jest.mock("../services/userServices", () => ({ getAllUsers: jest.fn(), editUserById: jest.fn() }));
jest.mock("../services/apiClient", () => ({
  errorMessage: (res: any, fallback: string) => res?.response?.data?.error || fallback,
  isApiError: (res: any) => !!res && res.isAxiosError === true,
}));

const m = ws as jest.Mocked<typeof ws>;
const profile = {
  _id: "me", firstName: "Demo", lastName: "User", email: "demo@example.com", allTasks: [], involvedProjects: [],
  myProjects: [
    { _id: "p1", projectName: "Alpha", workspace: "w1" },
    { _id: "p2", projectName: "Beta", workspace: "w2" },
    { _id: "p3", projectName: "Legacy project" }, // created before workspaces existed
  ],
};
const summary = (id: string, name: string) => ({ _id: id, name, myRole: "owner", memberCount: 1, projectCount: 1 });

function render(workspaces: any[], { invites = [] as any[], client = makeTestClient() } = {}) {
  (getMe as jest.Mock).mockResolvedValue(profile);
  m.getWorkspaces.mockResolvedValue(workspaces);
  m.getMyInvites.mockResolvedValue(invites);
  m.getWorkspace.mockResolvedValue({ _id: "w1", name: "Acme Co", owner: "me", myRole: "owner", projectCount: 0, members: [{ user: { _id: "me", firstName: "Demo", lastName: "User", email: "demo@example.com" }, role: "owner" }] });
  m.getWorkspaceInvites.mockResolvedValue([]);
  return renderWithProviders(<Dashboard />, { client, store: makeTestStore(false, null) });
}
const visibleProjects = () => ["Alpha", "Beta", "Legacy project"].filter((n) => screen.queryByText(n));

beforeEach(() => {
  jest.resetAllMocks();
  window.localStorage.clear();
});

describe("first run (no workspace yet)", () => {
  test("invites the user to create or join one, and the card opens the workspaces panel", async () => {
    render([]);
    const card = await screen.findByRole("region", { name: "Get started" });
    expect(within(card).getByText("Start with a workspace")).toBeInTheDocument();
    expect(screen.queryByLabelText("Workspace")).not.toBeInTheDocument(); // no filter until there is something to filter
    fireEvent.click(within(card).getByRole("button", { name: "Open workspaces" }));
    expect(await screen.findByRole("dialog", { name: "Workspaces" })).toBeInTheDocument();
  });

  test("REGRESSION: creating the first workspace does not close the panel that was used to create it", async () => {
    m.createWorkspace.mockResolvedValue({ _id: "w1", name: "Acme Co", myRole: "owner", memberCount: 1, projectCount: 0 });
    const { client } = render([]);
    fireEvent.click(await screen.findByRole("button", { name: "Open workspaces" }));
    await screen.findByRole("dialog", { name: "Workspaces" });

    fireEvent.change(screen.getByLabelText("New workspace"), { target: { value: "Acme Co" } });
    fireEvent.click(screen.getByRole("button", { name: "Create workspace" }));
    await waitFor(() => expect(m.createWorkspace).toHaveBeenCalledWith("Acme Co"));
    // the cache layer would now refresh the list; do the same here (the HTTP layer is mocked)
    m.getWorkspaces.mockResolvedValue([summary("w1", "Acme Co")]);
    await act(async () => {
      await client.invalidateQueries({ queryKey: qk.workspaces });
    });

    await waitFor(() => expect(screen.queryByRole("region", { name: "Get started" })).not.toBeInTheDocument()); // the card is gone...
    expect(screen.getByRole("dialog", { name: "Workspaces" })).toBeInTheDocument(); // ...but the panel the user is in stays
    expect(await screen.findByRole("heading", { name: "Acme Co" })).toBeInTheDocument();
  });
});

describe("workspace filter", () => {
  const two = [summary("w1", "Acme Co"), summary("w2", "Side Gig")];

  test("shows every project by default, including older ones with no workspace", async () => {
    render(two);
    await screen.findByLabelText("Workspace");
    expect(visibleProjects()).toEqual(["Alpha", "Beta", "Legacy project"]);
    expect(screen.queryByRole("region", { name: "Get started" })).not.toBeInTheDocument();
  });

  test("narrows the list to one workspace and remembers the choice", async () => {
    const first = render(two);
    fireEvent.change(await screen.findByLabelText("Workspace"), { target: { value: "w1" } });
    expect(visibleProjects()).toEqual(["Alpha"]);
    expect(window.localStorage.getItem("tms.workspaceFilter")).toBe("w1");
    first.unmount();

    render(two); // next visit
    await screen.findByLabelText("Workspace");
    expect(screen.getByLabelText("Workspace")).toHaveValue("w1");
    expect(visibleProjects()).toEqual(["Alpha"]);
  });

  test("a remembered workspace that no longer exists falls back to showing everything", async () => {
    window.localStorage.setItem("tms.workspaceFilter", "deleted-workspace");
    render(two);
    await screen.findByLabelText("Workspace");
    expect(screen.getByLabelText("Workspace")).toHaveValue("all");
    expect(visibleProjects()).toEqual(["Alpha", "Beta", "Legacy project"]);
  });

  test("still works when the browser blocks storage", async () => {
    jest.spyOn(Storage.prototype, "getItem").mockImplementation(() => {
      throw new Error("blocked");
    });
    jest.spyOn(Storage.prototype, "setItem").mockImplementation(() => {
      throw new Error("blocked");
    });
    render(two);
    fireEvent.change(await screen.findByLabelText("Workspace"), { target: { value: "w2" } });
    expect(visibleProjects()).toEqual(["Beta"]);
  });
});

describe("invitations", () => {
  test("a pending invitation is offered on the dashboard and can be accepted", async () => {
    m.acceptInviteById.mockResolvedValue({ workspace: { _id: "w9", name: "Newco" } });
    render([summary("w1", "Acme Co")], { invites: [{ _id: "i1", workspaceName: "Newco", inviterName: "Bo Boss", role: "member", status: "pending" }] });
    expect(await screen.findByText("You have an invitation")).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Accept the invitation to Newco" }));
    await waitFor(() => expect(m.acceptInviteById).toHaveBeenCalledWith("i1"));
  });

  test("the workspaces icon shows that an invitation is waiting", async () => {
    render([summary("w1", "Acme Co")], { invites: [{ _id: "i1", workspaceName: "Newco", inviterName: "Bo", role: "member", status: "pending" }] });
    await waitFor(() => expect(screen.getAllByLabelText("Workspaces, 1 invitation waiting").length).toBeGreaterThan(0));
  });
});

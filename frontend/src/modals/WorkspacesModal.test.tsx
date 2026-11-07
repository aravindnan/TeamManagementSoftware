import React from "react";
import { screen, fireEvent, waitFor, within } from "@testing-library/react";
import WorkspacesModal from "./WorkspacesModal";
import * as ws from "../services/workspaceServices";
import { makeTestStore, renderWithProviders } from "../testUtils";

jest.mock("../services/workspaceServices");
jest.mock("../services/authServices", () => ({ getMe: jest.fn() }));
jest.mock("../services/notificationServices", () => ({ getNotifications: jest.fn(), getUnreadCount: jest.fn() }));
jest.mock("../services/projectServices", () => ({}));
jest.mock("../services/taskServices", () => ({}));
jest.mock("../services/userServices", () => ({ getAllUsers: jest.fn() }));
jest.mock("../services/apiClient", () => ({
  errorMessage: (res: any, fallback: string) => res?.response?.data?.error || fallback,
  isApiError: (res: any) => !!res && res.isAxiosError === true,
}));

const m = ws as jest.Mocked<typeof ws>;
const refused = (error: string) => ({ isAxiosError: true, response: { status: 403, data: { error } } });
const person = (id: string, first: string) => ({ _id: id, firstName: first, lastName: "Test", email: `${first.toLowerCase()}@example.com` });

/** A workspace as the server returns it, seen by `me` with role `myRole`. Owner is "own", admin "adm", member "mem". */
const detail = (myRole: "owner" | "admin" | "member", extra: any = {}) => ({
  _id: "w1", name: "Acme Co", owner: "own", myRole, projectCount: 2,
  members: [
    { user: person("own", "Olive"), role: "owner" },
    { user: person("adm", "Adam"), role: "admin" },
    { user: person("mem", "Mia"), role: "member" },
  ],
  ...extra,
});
const summary = (myRole: string) => ({ _id: "w1", name: "Acme Co", myRole, memberCount: 3, projectCount: 2 });
const meIs = { owner: "own", admin: "adm", member: "mem" } as const;

function open(myRole: "owner" | "admin" | "member", { workspaces, invites = [] }: { workspaces?: any[]; invites?: any[] } = {}) {
  m.getWorkspaces.mockResolvedValue(workspaces ?? [summary(myRole)]);
  m.getWorkspace.mockResolvedValue(detail(myRole));
  m.getWorkspaceInvites.mockResolvedValue(invites);
  m.getMyInvites.mockResolvedValue([]);
  const onClose = jest.fn();
  const utils = renderWithProviders(<WorkspacesModal setOpen={onClose} />, { store: makeTestStore(true, { _id: meIs[myRole] }) });
  return { ...utils, onClose };
}
const ready = () => screen.findByRole("heading", { name: /acme co/i });
const confirm = (name: RegExp | string) => {
  fireEvent.click(screen.getByRole("button", { name }));
  fireEvent.click(screen.getByRole("button", { name: typeof name === "string" ? new RegExp(name) : name }));
};

beforeEach(() => jest.resetAllMocks());

describe("the list", () => {
  test("shows each workspace with your role and its size", async () => {
    open("member");
    await ready();
    const nav = screen.getByRole("navigation", { name: "Your workspaces" });
    expect(within(nav).getByText("Acme Co")).toBeInTheDocument();
    expect(within(nav).getByText("Member · 3 members · 2 projects")).toBeInTheDocument();
  });

  test("with no workspace it says so and invites you to create one", async () => {
    open("owner", { workspaces: [] });
    expect(await screen.findByText("You are not in a workspace yet")).toBeInTheDocument();
  });

  test("creating a workspace validates the name, calls the server and selects the new one", async () => {
    open("owner");
    await ready();
    const input = screen.getByLabelText("New workspace");
    fireEvent.change(input, { target: { value: "x" } });
    fireEvent.click(screen.getByRole("button", { name: "Create workspace" }));
    expect(await screen.findByRole("alert")).toHaveTextContent(/at least 2 characters/);
    expect(m.createWorkspace).not.toHaveBeenCalled();

    m.createWorkspace.mockResolvedValue({ _id: "w2", name: "Side Project", myRole: "owner", memberCount: 1, projectCount: 0 });
    fireEvent.change(input, { target: { value: "  Side Project " } });
    fireEvent.click(screen.getByRole("button", { name: "Create workspace" }));
    await waitFor(() => expect(m.createWorkspace).toHaveBeenCalledWith("Side Project"));
    await waitFor(() => expect(input).toHaveValue(""));
  });

  test("a refused creation explains why", async () => {
    open("owner");
    await ready();
    m.createWorkspace.mockResolvedValue(refused("You can own at most 20 workspaces"));
    fireEvent.change(screen.getByLabelText("New workspace"), { target: { value: "Another one" } });
    fireEvent.click(screen.getByRole("button", { name: "Create workspace" }));
    expect(await screen.findByRole("alert")).toHaveTextContent("at most 20 workspaces");
  });
});

describe("as a plain member", () => {
  test("sees the roster but no invitations, no role controls, no owner actions; may leave", async () => {
    open("member");
    await ready();
    expect(screen.getByText("Members (3)")).toBeInTheDocument();
    expect(screen.queryByText("Invite people")).not.toBeInTheDocument();
    expect(screen.queryByText("Owner actions")).not.toBeInTheDocument();
    expect(screen.queryByLabelText(/^Role of/)).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /^Remove Olive|^Remove Adam/ })).not.toBeInTheDocument();
    expect(screen.queryByTitle("Click to rename")).not.toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Leave this workspace" })).toBeInTheDocument();
    expect(m.getWorkspaceInvites).not.toHaveBeenCalled(); // does not even ask for what it may not see
  });

  test("leaving needs a second click, calls the server, and moves on", async () => {
    m.removeWorkspaceMember.mockResolvedValue({ removed: true });
    open("member");
    await ready();
    confirm("Leave this workspace");
    await waitFor(() => expect(m.removeWorkspaceMember).toHaveBeenCalledWith("w1", "mem"));
  });
});

describe("as an admin", () => {
  test("can invite members (not admins) and remove members (not other admins or the owner)", async () => {
    open("admin");
    await ready();
    expect(screen.getByText("Invite people")).toBeInTheDocument();
    expect(screen.queryByLabelText("Role for the invitation")).not.toBeInTheDocument(); // admins can only invite members
    expect(screen.getByRole("button", { name: "Remove Mia Test" })).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Remove Olive Test" })).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Remove Adam Test" })).not.toBeInTheDocument(); // that is themselves: Leave
    expect(screen.getByRole("button", { name: "Leave this workspace" })).toBeInTheDocument();
    expect(screen.queryByLabelText(/^Role of/)).not.toBeInTheDocument(); // only the owner changes roles
    expect(screen.queryByText("Owner actions")).not.toBeInTheDocument();
  });

  test("can rename the workspace, and Escape cancels the rename without closing the dialog", async () => {
    m.renameWorkspace.mockResolvedValue({ _id: "w1", name: "Renamed" });
    const { onClose } = open("admin");
    await ready();
    fireEvent.click(screen.getByTitle("Click to rename"));
    fireEvent.change(screen.getByLabelText("Workspace name"), { target: { value: "never saved" } });
    fireEvent.keyDown(screen.getByLabelText("Workspace name"), { key: "Escape" });
    expect(m.renameWorkspace).not.toHaveBeenCalled();
    expect(onClose).not.toHaveBeenCalled();

    fireEvent.click(screen.getByTitle("Click to rename"));
    fireEvent.change(screen.getByLabelText("Workspace name"), { target: { value: "Renamed" } });
    fireEvent.keyDown(screen.getByLabelText("Workspace name"), { key: "Enter" });
    await waitFor(() => expect(m.renameWorkspace).toHaveBeenCalledWith("w1", "Renamed"));
  });

  test("a rename that is too short is refused locally", async () => {
    open("admin");
    await ready();
    fireEvent.click(screen.getByTitle("Click to rename"));
    fireEvent.change(screen.getByLabelText("Workspace name"), { target: { value: "A" } });
    fireEvent.keyDown(screen.getByLabelText("Workspace name"), { key: "Enter" });
    expect(await screen.findByRole("alert")).toHaveTextContent(/at least 2 characters/);
    expect(m.renameWorkspace).not.toHaveBeenCalled();
  });
});

describe("as the owner", () => {
  test("changes roles through a select, and the owner's own row is just a label", async () => {
    m.setMemberRole.mockResolvedValue({ userId: "mem", role: "admin" });
    open("owner");
    await ready();
    expect(screen.queryByLabelText("Role of Olive Test")).not.toBeInTheDocument();
    fireEvent.change(screen.getByLabelText("Role of Mia Test"), { target: { value: "admin" } });
    await waitFor(() => expect(m.setMemberRole).toHaveBeenCalledWith("w1", "mem", "admin"));
  });

  test("removes a member after a confirming second click", async () => {
    m.removeWorkspaceMember.mockResolvedValue({ removed: true, projectsAffected: 1 });
    open("owner");
    await ready();
    fireEvent.click(screen.getByRole("button", { name: "Remove Mia Test" }));
    expect(m.removeWorkspaceMember).not.toHaveBeenCalled(); // armed only
    fireEvent.click(screen.getByRole("button", { name: /Remove\? Remove Mia Test/ }));
    await waitFor(() => expect(m.removeWorkspaceMember).toHaveBeenCalledWith("w1", "mem"));
    expect(screen.queryByRole("button", { name: "Leave this workspace" })).not.toBeInTheDocument(); // the owner cannot leave
  });

  test("a refused removal is explained", async () => {
    m.removeWorkspaceMember.mockResolvedValue(refused("Only the owner can remove an admin"));
    open("owner");
    await ready();
    fireEvent.click(screen.getByRole("button", { name: "Remove Adam Test" }));
    fireEvent.click(screen.getByRole("button", { name: /Remove\? Remove Adam Test/ }));
    expect(await screen.findByRole("alert")).toHaveTextContent("Only the owner can remove an admin");
  });

  test("transfers ownership only after choosing someone and confirming", async () => {
    m.transferWorkspace.mockResolvedValue({ owner: "adm" });
    open("owner");
    await ready();
    const transfer = screen.getByRole("button", { name: "Transfer" });
    expect(transfer).toBeDisabled();
    const select = screen.getByLabelText("New owner");
    expect(within(select).queryByRole("option", { name: "Olive Test" })).not.toBeInTheDocument(); // not themselves
    fireEvent.change(select, { target: { value: "adm" } });
    fireEvent.click(screen.getByRole("button", { name: "Transfer" }));
    fireEvent.click(screen.getByRole("button", { name: /Transfer\?/ }));
    await waitFor(() => expect(m.transferWorkspace).toHaveBeenCalledWith("w1", "adm"));
  });

  test("deleting asks twice, and a refusal (projects remain) is shown", async () => {
    m.deleteWorkspace.mockResolvedValue({ isAxiosError: true, response: { status: 409, data: { error: "This workspace still has 2 projects. Delete or move them first." } } });
    open("owner");
    await ready();
    fireEvent.click(screen.getByRole("button", { name: "Delete this workspace" }));
    expect(m.deleteWorkspace).not.toHaveBeenCalled();
    fireEvent.click(screen.getByRole("button", { name: /Delete for good\?/ }));
    expect(await screen.findByRole("alert")).toHaveTextContent("still has 2 projects");
  });

  test("can invite an admin, unlike an admin", async () => {
    open("owner");
    await ready();
    expect(within(screen.getByLabelText("Role for the invitation")).getAllByRole("option").map((o) => o.textContent)).toEqual(["Member", "Admin"]);
  });
});

describe("invitations", () => {
  const created = { invite: { _id: "i1", email: "new@example.com", role: "member", expiresAt: new Date(Date.now() + 7 * 86400000).toISOString() }, link: "http://localhost:3000/invite/SECRET-TOKEN" };

  test("creating one shows the link to copy, once, with what it can and cannot do", async () => {
    m.createInvite.mockResolvedValue(created);
    open("admin");
    await ready();
    fireEvent.change(screen.getByLabelText("Email address to invite"), { target: { value: " new@example.com " } });
    fireEvent.click(screen.getByRole("button", { name: "Create invitation" }));
    await waitFor(() => expect(m.createInvite).toHaveBeenCalledWith("w1", "new@example.com", "member"));
    expect(await screen.findByLabelText("Invitation link")).toHaveValue("http://localhost:3000/invite/SECRET-TOKEN");
    expect(screen.getByRole("status")).toHaveTextContent(/works once, expires in 7 days, and can only be accepted from that address/);
    expect(screen.getByLabelText("Email address to invite")).toHaveValue("");
  });

  test("copying the link uses the clipboard and says so", async () => {
    m.createInvite.mockResolvedValue(created);
    const writeText = jest.fn().mockResolvedValue(undefined);
    Object.assign(navigator, { clipboard: { writeText } });
    open("admin");
    await ready();
    fireEvent.change(screen.getByLabelText("Email address to invite"), { target: { value: "new@example.com" } });
    fireEvent.click(screen.getByRole("button", { name: "Create invitation" }));
    fireEvent.click(await screen.findByRole("button", { name: "Copy" }));
    await waitFor(() => expect(writeText).toHaveBeenCalledWith("http://localhost:3000/invite/SECRET-TOKEN"));
    expect(await screen.findByRole("button", { name: "Copied" })).toBeInTheDocument();
  });

  test("a bad address is refused locally; a server refusal is shown", async () => {
    open("admin");
    await ready();
    fireEvent.change(screen.getByLabelText("Email address to invite"), { target: { value: "not-an-email" } });
    fireEvent.click(screen.getByRole("button", { name: "Create invitation" }));
    expect(await screen.findByRole("alert")).toHaveTextContent(/valid email/i);
    expect(m.createInvite).not.toHaveBeenCalled();

    m.createInvite.mockResolvedValue({ isAxiosError: true, response: { status: 409, data: { error: "That person is already in this workspace" } } });
    fireEvent.change(screen.getByLabelText("Email address to invite"), { target: { value: "mia@example.com" } });
    fireEvent.click(screen.getByRole("button", { name: "Create invitation" }));
    expect(await screen.findByText("That person is already in this workspace")).toBeInTheDocument();
  });

  test("pending invitations list their role and expiry; a new link replaces the old; revoking needs confirmation", async () => {
    const pending = [{ _id: "i9", email: "wait@example.com", role: "admin", status: "pending", expiresAt: new Date(Date.now() + 3 * 86400000 + 3600000).toISOString() }];
    m.regenerateInvite.mockResolvedValue({ invite: pending[0], link: "http://localhost:3000/invite/NEW-LINK" });
    m.revokeInvite.mockResolvedValue({ revoked: true });
    open("owner", { invites: pending });
    expect(await screen.findByText("wait@example.com")).toBeInTheDocument();
    expect(screen.getByText("Admin · expires in 3 days")).toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: "Get a new link for wait@example.com" }));
    expect(await screen.findByLabelText("Invitation link")).toHaveValue("http://localhost:3000/invite/NEW-LINK");
    expect(m.regenerateInvite).toHaveBeenCalledWith("w1", "i9");

    fireEvent.click(screen.getByRole("button", { name: "Revoke the invitation for wait@example.com" }));
    expect(m.revokeInvite).not.toHaveBeenCalled();
    fireEvent.click(screen.getByRole("button", { name: /Revoke\? Revoke the invitation/ }));
    await waitFor(() => expect(m.revokeInvite).toHaveBeenCalledWith("w1", "i9"));
    await waitFor(() => expect(screen.queryByLabelText("Invitation link")).not.toBeInTheDocument()); // the stale link is hidden
  });

  test("no pending invitations says so", async () => {
    open("admin");
    expect(await screen.findByText("No pending invitations.")).toBeInTheDocument();
  });
});

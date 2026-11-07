import React from "react";
import { screen, fireEvent, waitFor } from "@testing-library/react";
import { Route, Routes, useLocation } from "react-router-dom";
import InvitePage from "./InvitePage";
import { getMe, googleLogin, logoutUser } from "../services/authServices";
import { acceptInviteByToken, previewInvite } from "../services/workspaceServices";
import { renderWithProviders } from "../testUtils";

jest.mock("../services/authServices", () => ({ getMe: jest.fn(), googleLogin: jest.fn(), logoutUser: jest.fn() }));
jest.mock("../services/workspaceServices", () => ({
  previewInvite: jest.fn(), acceptInviteByToken: jest.fn(),
  getWorkspaces: jest.fn(), getWorkspace: jest.fn(), getWorkspaceInvites: jest.fn(), getMyInvites: jest.fn(),
}));
jest.mock("../services/notificationServices", () => ({ getNotifications: jest.fn(), getUnreadCount: jest.fn() }));
jest.mock("../services/projectServices", () => ({ getProjectById: jest.fn() }));
jest.mock("../services/taskServices", () => ({ getTaskById: jest.fn() }));
jest.mock("../services/userServices", () => ({ getAllUsers: jest.fn() }));
jest.mock("../services/apiClient", () => ({
  errorMessage: (res: any, fallback: string) => res?.response?.data?.error || fallback,
  isApiError: (res: any) => !!res && res.isAxiosError === true,
}));
jest.mock("../env/environment", () => ({ GOOGLE_CLIENT_ID: "test-client", ENV: "http://x" }));
// the real Google button needs Google's script; a stub that "signs in" when clicked is enough here
jest.mock("../components/GoogleSignInButton", () => ({ __esModule: true, default: ({ onCredential }: any) => <button onClick={() => onCredential("cred-123")}>Google stub</button> }));

const Where = ({ label }: { label: string }) => {
  const loc = useLocation();
  return <div data-testid={label}>{`${loc.pathname}${loc.search}`}</div>;
};
const renderInvite = (token = "tok-" + "x".repeat(30)) =>
  renderWithProviders(
    <Routes>
      <Route path="/invite/:token" element={<InvitePage />} />
      <Route path="/login" element={<Where label="login" />} />
      <Route path="/register" element={<Where label="register" />} />
      <Route path="/dashboard" element={<Where label="dashboard" />} />
    </Routes>,
    { route: `/invite/${token}` }
  );

const preview = (o: any = {}) => ({ workspaceName: "Acme Co", inviterName: "Bo Boss", email: "ann@example.com", role: "member", status: "pending", ...o });
const signedOut = () => (getMe as jest.Mock).mockResolvedValue(null);
const signedInAs = (email: string) => (getMe as jest.Mock).mockResolvedValue({ _id: "me", email });

beforeEach(() => {
  for (const fn of [previewInvite, acceptInviteByToken, getMe, googleLogin, logoutUser]) (fn as jest.Mock).mockReset();
});

describe("what the visitor sees about the invitation", () => {
  test("loading, then who invited them to what and as which role", async () => {
    (previewInvite as jest.Mock).mockResolvedValue(preview({ role: "admin" }));
    signedOut();
    renderInvite();
    expect(screen.getByText(/loading invitation/i)).toBeInTheDocument();
    expect(await screen.findByRole("heading", { name: "You're invited" })).toBeInTheDocument();
    expect(screen.getByText("Bo Boss")).toBeInTheDocument();
    expect(screen.getByText("Acme Co")).toBeInTheDocument();
    expect(screen.getByText(/as an admin/)).toBeInTheDocument();
    expect(screen.getByText("This invitation is for ann@example.com")).toBeInTheDocument();
  });

  test("an unknown link says so plainly", async () => {
    (previewInvite as jest.Mock).mockResolvedValue({ isAxiosError: true, response: { status: 404, data: { error: "Invitation not found" } } });
    signedOut();
    renderInvite();
    expect(await screen.findByRole("heading", { name: /isn't valid/i })).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /accept|join/i })).not.toBeInTheDocument();
  });

  test.each([
    ["accepted", /already been used/i],
    ["revoked", /was cancelled/i],
    ["expired", /has expired/i],
  ])("a %s invitation cannot be used and explains why", async (status, message) => {
    (previewInvite as jest.Mock).mockResolvedValue(preview({ status }));
    signedInAs("ann@example.com");
    renderInvite();
    expect(await screen.findByRole("alert")).toHaveTextContent(message);
    expect(screen.queryByRole("button", { name: /join/i })).not.toBeInTheDocument();
  });

  test("a failed load offers another try", async () => {
    (previewInvite as jest.Mock).mockResolvedValueOnce({ isAxiosError: true, response: { status: 500, data: { error: "Boom" } } });
    signedOut();
    renderInvite();
    expect(await screen.findByText(/couldn't load this invitation/i)).toBeInTheDocument();
    (previewInvite as jest.Mock).mockResolvedValueOnce(preview());
    fireEvent.click(screen.getByRole("button", { name: "Try again" }));
    expect(await screen.findByRole("heading", { name: "You're invited" })).toBeInTheDocument();
  });
});

describe("signed out", () => {
  beforeEach(() => {
    (previewInvite as jest.Mock).mockResolvedValue(preview());
    signedOut();
  });

  test("sign-in and sign-up both carry the visitor back here, and sign-up prefills the invited address", async () => {
    const token = "tok-" + "y".repeat(30);
    renderInvite(token);
    const login = await screen.findByRole("link", { name: "Log in" });
    expect(login).toHaveAttribute("href", `/login?redirect=%2Finvite%2F${token}`);
    const register = screen.getByRole("link", { name: "Create an account" });
    expect(register.getAttribute("href")).toContain("email=ann%40example.com");
    expect(register.getAttribute("href")).toContain(`redirect=%2Finvite%2F${token}`);
    expect(screen.queryByRole("button", { name: /join/i })).not.toBeInTheDocument();
  });

  test("continuing with Google signs in and then offers the invitation to accept", async () => {
    (googleLogin as jest.Mock).mockResolvedValue({ success: true });
    renderInvite();
    await screen.findByRole("link", { name: "Log in" });
    (getMe as jest.Mock).mockResolvedValue({ _id: "me", email: "ann@example.com" }); // the session now exists
    fireEvent.click(screen.getByRole("button", { name: "Google stub" }));
    await waitFor(() => expect(googleLogin).toHaveBeenCalledWith("cred-123"));
    expect(await screen.findByRole("button", { name: "Join Acme Co" })).toBeInTheDocument();
  });

  test("a refused Google sign-in explains itself", async () => {
    (googleLogin as jest.Mock).mockResolvedValue({ isAxiosError: true, response: { data: { error: "Your Google email address is not verified" } } });
    renderInvite();
    await screen.findByRole("link", { name: "Log in" });
    fireEvent.click(screen.getByRole("button", { name: "Google stub" }));
    expect(await screen.findByRole("alert")).toHaveTextContent(/not verified/i);
  });
});

describe("signed in as the invited person", () => {
  beforeEach(() => {
    (previewInvite as jest.Mock).mockResolvedValue(preview());
    signedInAs("Ann@Example.com"); // case differences are not a mismatch
  });

  test("accepting joins the workspace and confirms it", async () => {
    (acceptInviteByToken as jest.Mock).mockResolvedValue({ workspace: { _id: "w1", name: "Acme Co" } });
    const token = "tok-" + "z".repeat(30);
    renderInvite(token);
    fireEvent.click(await screen.findByRole("button", { name: "Join Acme Co" }));
    expect(acceptInviteByToken).toHaveBeenCalledWith(token);
    expect(await screen.findByRole("heading", { name: "You joined Acme Co" })).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: /go to your dashboard/i }));
    expect(screen.getByTestId("dashboard")).toHaveTextContent("/dashboard");
  });

  test("a refusal from the server is shown and the visitor can try again", async () => {
    (acceptInviteByToken as jest.Mock).mockResolvedValue({ isAxiosError: true, response: { status: 410, data: { error: "This invitation is no longer valid" } } });
    renderInvite();
    fireEvent.click(await screen.findByRole("button", { name: "Join Acme Co" }));
    expect(await screen.findByRole("alert")).toHaveTextContent("no longer valid");
    expect(screen.getByRole("button", { name: "Join Acme Co" })).toBeEnabled();
  });

  test("the button is disabled while joining so it cannot be double-clicked", async () => {
    let finish!: (v: any) => void;
    (acceptInviteByToken as jest.Mock).mockReturnValue(new Promise((r) => (finish = r)));
    renderInvite();
    fireEvent.click(await screen.findByRole("button", { name: "Join Acme Co" }));
    expect(screen.getByRole("button", { name: "Joining..." })).toBeDisabled();
    finish({ workspace: { _id: "w", name: "Acme Co" } });
  });
});

describe("signed in as someone else", () => {
  test("is told which account is wrong, cannot accept, and can switch accounts", async () => {
    (previewInvite as jest.Mock).mockResolvedValue(preview());
    signedInAs("someone.else@example.com");
    (logoutUser as jest.Mock).mockResolvedValue({ logoutStatus: true });
    const token = "tok-" + "m".repeat(30);
    renderInvite(token);
    expect(await screen.findByRole("alert")).toHaveTextContent("You are signed in as someone.else@example.com, but this invitation was sent to ann@example.com.");
    expect(screen.queryByRole("button", { name: /join/i })).not.toBeInTheDocument();
    expect(acceptInviteByToken).not.toHaveBeenCalled();
    fireEvent.click(screen.getByRole("button", { name: /different account/i }));
    await waitFor(() => expect(logoutUser).toHaveBeenCalled());
    expect(await screen.findByTestId("login")).toHaveTextContent(`/login?redirect=%2Finvite%2F${token}`);
  });

  test("a failure checking the session offers a retry instead of a wrong screen", async () => {
    (previewInvite as jest.Mock).mockResolvedValue(preview());
    (getMe as jest.Mock).mockResolvedValue({ isAxiosError: true, response: { status: 500, data: { error: "Down" } } });
    renderInvite();
    expect(await screen.findByRole("alert")).toHaveTextContent("Down");
    expect(screen.getByRole("button", { name: "Try again" })).toBeInTheDocument();
  });
});

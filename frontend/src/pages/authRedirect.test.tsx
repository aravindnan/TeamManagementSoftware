import React from "react";
import { screen, fireEvent, waitFor } from "@testing-library/react";
import { Route, Routes, useLocation } from "react-router-dom";
import Login from "./Login";
import Register from "./Register";
import { getMe, googleLogin, loginUser, registerUser } from "../services/authServices";
import { renderWithProviders, makeTestStore } from "../testUtils";

jest.mock("../services/authServices", () => ({ getMe: jest.fn(), googleLogin: jest.fn(), loginUser: jest.fn(), registerUser: jest.fn() }));
jest.mock("../services/apiClient", () => ({
  errorMessage: (res: any, fallback: string) => res?.response?.data?.error || fallback,
  isApiError: (res: any) => !!res && res.isAxiosError === true,
}));
jest.mock("../env/environment", () => ({ GOOGLE_CLIENT_ID: "test-client", ENV: "http://x" }));
jest.mock("../components/GoogleSignInButton", () => ({ __esModule: true, default: ({ onCredential, text }: any) => <button onClick={() => onCredential("cred-123")}>{`Google (${text})`}</button> }));

const Where = ({ label }: { label: string }) => {
  const loc = useLocation();
  return <div data-testid={label}>{`${loc.pathname}${loc.search}`}</div>;
};
const app = (route: string) =>
  renderWithProviders(
    <Routes>
      <Route path="/login" element={<Login />} />
      <Route path="/register" element={<Register />} />
      <Route path="/dashboard" element={<Where label="dashboard" />} />
      <Route path="/invite/:token" element={<Where label="invite" />} />
      <Route path="*" element={<Where label="elsewhere" />} />
    </Routes>,
    { route, store: makeTestStore(false, null) }
  );

beforeEach(() => {
  (getMe as jest.Mock).mockReset().mockResolvedValue(null);
  (googleLogin as jest.Mock).mockReset();
  (loginUser as jest.Mock).mockReset();
  (registerUser as jest.Mock).mockReset();
});

const logIn = () => {
  fireEvent.change(screen.getByPlaceholderText("Username"), { target: { name: "username", value: "ann" } });
  fireEvent.change(screen.getByPlaceholderText("Password"), { target: { name: "password", value: "Passw0rd!x" } });
  fireEvent.click(screen.getByRole("button", { name: "Log In" }));
};

describe("Login", () => {
  test("after signing in it returns to the page it was sent from", async () => {
    (loginUser as jest.Mock).mockResolvedValue({ success: true, message: "ok" });
    app("/login?redirect=%2Finvite%2Fabc123");
    logIn();
    expect(await screen.findByTestId("invite")).toHaveTextContent("/invite/abc123");
  });

  test.each([
    ["an absolute URL", "https://evil.example/steal"],
    ["a protocol-relative URL", "//evil.example"],
    ["javascript:", "javascript:alert(1)"],
  ])("ignores %s in the redirect and goes to the dashboard", async (_n, bad) => {
    (loginUser as jest.Mock).mockResolvedValue({ success: true, message: "ok" });
    app(`/login?redirect=${encodeURIComponent(bad)}`);
    logIn();
    expect(await screen.findByTestId("dashboard")).toHaveTextContent("/dashboard");
  });

  test("with no redirect it goes to the dashboard", async () => {
    (loginUser as jest.Mock).mockResolvedValue({ success: true, message: "ok" });
    app("/login");
    logIn();
    expect(await screen.findByTestId("dashboard")).toBeInTheDocument();
  });

  test("someone already signed in is sent straight to where they were headed", async () => {
    (getMe as jest.Mock).mockResolvedValue({ _id: "me", email: "a@b.co" });
    app("/login?redirect=%2Finvite%2Fabc123");
    expect(await screen.findByTestId("invite")).toHaveTextContent("/invite/abc123");
  });

  test("Google sign-in sends the credential to the server and then follows the redirect", async () => {
    (googleLogin as jest.Mock).mockResolvedValue({ success: true });
    app("/login?redirect=%2Finvite%2Fabc123");
    fireEvent.click(await screen.findByRole("button", { name: "Google (signin_with)" }));
    await waitFor(() => expect(googleLogin).toHaveBeenCalledWith("cred-123"));
    expect(await screen.findByTestId("invite")).toBeInTheDocument();
  });

  test("a refused Google sign-in shows why and offers another try", async () => {
    (googleLogin as jest.Mock).mockResolvedValue({ isAxiosError: true, response: { data: { error: "Invalid Google credential" } } });
    app("/login");
    fireEvent.click(await screen.findByRole("button", { name: "Google (signin_with)" }));
    expect(await screen.findByText("Invalid Google credential")).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: /try again/i }));
    expect(await screen.findByRole("button", { name: "Google (signin_with)" })).toBeInTheDocument();
  });

  test("the sign-up link keeps the destination", async () => {
    app("/login?redirect=%2Finvite%2Fabc123");
    expect(await screen.findByRole("link", { name: /sign up/i })).toHaveAttribute("href", "/register?redirect=%2Finvite%2Fabc123");
  });
});

describe("Register", () => {
  test("prefills the address an invitation was sent to, and offers Google sign-up", async () => {
    app("/register?email=ann%40example.com&redirect=%2Finvite%2Fabc123");
    expect(await screen.findByDisplayValue("ann@example.com")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Google (signup_with)" })).toBeInTheDocument();
  });

  test("Google sign-up follows the redirect", async () => {
    (googleLogin as jest.Mock).mockResolvedValue({ success: true, isNewUser: true });
    app("/register?redirect=%2Finvite%2Fabc123");
    fireEvent.click(await screen.findByRole("button", { name: "Google (signup_with)" }));
    expect(await screen.findByTestId("invite")).toHaveTextContent("/invite/abc123");
  });

  test("the login link keeps the destination", async () => {
    app("/register?redirect=%2Finvite%2Fabc123");
    expect(await screen.findByRole("link", { name: /already have an account/i })).toHaveAttribute("href", "/login?redirect=%2Finvite%2Fabc123");
  });

  test("a failed Google sign-up is reported", async () => {
    (googleLogin as jest.Mock).mockResolvedValue({ isAxiosError: true, response: { data: { error: "That account could not be created" } } });
    app("/register");
    fireEvent.click(await screen.findByRole("button", { name: "Google (signup_with)" }));
    expect(await screen.findByText("That account could not be created")).toBeInTheDocument();
  });
});

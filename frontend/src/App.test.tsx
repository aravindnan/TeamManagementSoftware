import React from "react";
import { screen, waitFor } from "@testing-library/react";
import Login from "./pages/Login";
import { getMe } from "./services/authServices";
import { renderWithProviders } from "./testUtils";

// Network layer is mocked: these tests are about the UI contract, not HTTP.
jest.mock("./services/authServices", () => ({
  getMe: jest.fn(),
  loginUser: jest.fn(),
}));
jest.mock("./services/apiClient", () => ({
  errorMessage: (res: any, fallback: string) => res?.response?.data?.error || fallback,
  isApiError: (res: any) => !!res && res.isAxiosError === true,
}));

describe("Login page", () => {
  test("renders the credentials form for a signed-out visitor", async () => {
    (getMe as jest.Mock).mockResolvedValue(null); // no session
    renderWithProviders(<Login />);
    await waitFor(() => expect(document.title).toBe("TMS • Log In"));
    expect(screen.getByPlaceholderText(/username/i)).toBeInTheDocument();
    expect(screen.getByPlaceholderText(/password/i)).toBeInTheDocument();
  });
});

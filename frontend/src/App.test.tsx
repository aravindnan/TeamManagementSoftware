import React from "react";
import { render, screen, waitFor } from "@testing-library/react";
import { Provider } from "react-redux";
import { MemoryRouter } from "react-router-dom";
import { store } from "./redux/store";
import Login from "./pages/Login";

// Network layer is mocked: these tests are about the UI contract, not HTTP.
jest.mock("./services/authServices", () => ({
  getMe: jest.fn(),
  loginUser: jest.fn(),
}));
jest.mock("./services/apiClient", () => ({
  errorMessage: (res: any, fallback: string) => res?.response?.data?.error || fallback,
}));

import { getMe } from "./services/authServices";

describe("Login page", () => {
  // CRA resets mocks between tests, so the "no active session" answer is set here.
  beforeEach(() => {
    (getMe as jest.Mock).mockResolvedValue(null);
  });

  test("renders the credentials form for a signed-out visitor", async () => {
    render(
      <Provider store={store}>
        <MemoryRouter>
          <Login />
        </MemoryRouter>
      </Provider>
    );
    await waitFor(() => expect(document.title).toBe("TMS • Log In"));
    expect(screen.getByPlaceholderText(/username/i)).toBeInTheDocument();
    expect(screen.getByPlaceholderText(/password/i)).toBeInTheDocument();
  });
});

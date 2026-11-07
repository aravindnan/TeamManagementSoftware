import { errorMessage, isApiError } from "./apiClient";

jest.mock("axios", () => ({
  __esModule: true,
  default: { create: () => ({ interceptors: { response: { use: jest.fn() } } }) },
}));

describe("errorMessage", () => {
  test("prefers the server's error text", () => {
    expect(errorMessage({ response: { data: { error: "Invalid credentials" } } })).toBe("Invalid credentials");
  });
  test("explains network failures", () => {
    expect(errorMessage({ code: "ERR_NETWORK" })).toMatch(/could not reach the server/i);
  });
  test("falls back for unknown shapes", () => {
    expect(errorMessage(undefined, "Nope")).toBe("Nope");
  });
});

describe("isApiError", () => {
  test("detects error objects but not data", () => {
    expect(isApiError(new Error("x"))).toBe(true);
    expect(isApiError({ isAxiosError: true })).toBe(true);
    expect(isApiError({ _id: "1" })).toBe(false);
  });
});

import { isPublicPath } from "./apiClient";

describe("isPublicPath", () => {
  test.each(["/", "/login", "/register", "/invite/abc123"])("%s works signed out", (path) => expect(isPublicPath(path)).toBe(true));
  test.each(["/dashboard", "/project-page", "/task-page", "/invitefoo", "/invites"])("%s requires a session", (path) => expect(isPublicPath(path)).toBe(false));
});

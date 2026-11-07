import { safeRedirect, withRedirect } from "./redirect";

describe("safeRedirect", () => {
  test.each(["/dashboard", "/invite/abc123", "/project-page?id=1&task=2", "/invite/abc#frag"])("keeps the in-app path %p", (path) => {
    expect(safeRedirect(path)).toBe(path);
  });

  test.each([
    ["an absolute URL", "https://evil.example/phish"],
    ["a protocol-relative URL", "//evil.example"],
    ["a protocol-relative URL with extra slashes", "///evil.example"],
    ["a backslash trick", "/\\evil.example"],
    ["a javascript: URL", "javascript:alert(1)"],
    ["a data: URL", "data:text/html,<script>alert(1)</script>"],
    ["a relative path", "dashboard"],
    ["an embedded newline", "/ok\n//evil.example"],
    ["an embedded tab", "/\t/evil.example"],
    ["empty", ""],
    ["null", null],
    ["undefined", undefined],
  ])("refuses %s", (_name, input) => {
    expect(safeRedirect(input as any)).toBe("/dashboard");
  });

  test("uses a custom fallback", () => expect(safeRedirect("https://x.example", "/home")).toBe("/home"));
});

describe("withRedirect", () => {
  test("adds the destination and extras, encoded", () => {
    expect(withRedirect("/login", "/invite/a b")).toBe("/login?redirect=%2Finvite%2Fa+b");
    expect(withRedirect("/register", "/invite/t", { email: "a@b.co" })).toBe("/register?email=a%40b.co&redirect=%2Finvite%2Ft");
  });
  test("is just the page when there is nothing to carry", () => expect(withRedirect("/login", null)).toBe("/login"));
});

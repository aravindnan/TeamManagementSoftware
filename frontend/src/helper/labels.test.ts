import { addLabel, normalizeLabel } from "./labels";

describe("normalizeLabel", () => {
  test("trims and lower-cases", () => expect(normalizeLabel("  Front-End ")).toEqual({ ok: true, label: "front-end" }));
  test.each([
    ["", /type a label/i],
    ["   ", /type a label/i],
    ["x".repeat(25), /at most 24/],
    ["<script>", /letters, numbers/],
    ["-leading", /letters, numbers/],
    ["émoji", /letters, numbers/],
  ])("rejects %p", (input, reason) => {
    const r = normalizeLabel(input);
    expect(r.ok).toBe(false);
    expect((r as any).reason).toMatch(reason);
  });
  test("accepts the longest allowed label", () => expect(normalizeLabel("a".repeat(24)).ok).toBe(true));
});

describe("addLabel", () => {
  test("appends a normalised label", () => expect(addLabel(["bug"], " Urgent ")).toEqual({ labels: ["bug", "urgent"] }));
  test("ignores duplicates without an error", () => expect(addLabel(["bug"], "BUG")).toEqual({ labels: ["bug"] }));
  test("stops at eight labels", () => {
    const eight = Array.from({ length: 8 }, (_, i) => `l${i}`);
    expect(addLabel(eight, "ninth")).toEqual({ labels: eight, error: "A task can have at most 8 labels" });
  });
  test("reports invalid input and leaves the list unchanged", () => {
    expect(addLabel(["a"], "!!")).toEqual({ labels: ["a"], error: "Use letters, numbers, spaces, - or _" });
  });
});

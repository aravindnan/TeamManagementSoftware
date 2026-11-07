import { canChangeRole, canManage, canRemove, expiresIn, invitableRoles, isOwner, roleLabel } from "./workspaceRoles";

test("who manages the workspace", () => {
  expect([canManage("owner"), canManage("admin"), canManage("member"), canManage(undefined)]).toEqual([true, true, false, false]);
  expect([isOwner("owner"), isOwner("admin"), isOwner(undefined)]).toEqual([true, false, false]);
});

test("which roles can be invited", () => {
  expect(invitableRoles("owner")).toEqual(["member", "admin"]);
  expect(invitableRoles("admin")).toEqual(["member"]); // admins cannot mint admins
  expect(invitableRoles("member")).toEqual([]);
  expect(invitableRoles(undefined)).toEqual([]);
});

describe("canRemove", () => {
  test.each([
    // [me, target, isSelf, expected]
    ["owner", "admin", false, true],
    ["owner", "member", false, true],
    ["admin", "member", false, true],
    ["admin", "admin", false, false], // only the owner removes an admin
    ["admin", "owner", false, false],
    ["member", "member", false, false], // members cannot remove each other
    ["member", "admin", false, false],
    ["owner", "owner", true, false], // the owner cannot leave
    ["admin", "admin", true, true], // anyone else may leave
    ["member", "member", true, true],
  ] as const)("%s removing a %s (self=%s) -> %s", (me, target, self, expected) => {
    expect(canRemove(me, target, self)).toBe(expected);
  });
  test("is false without a role", () => expect(canRemove(undefined, "member", false)).toBe(false));
});

test("only the owner changes roles, and never the owner's own", () => {
  expect(canChangeRole("owner", "member")).toBe(true);
  expect(canChangeRole("owner", "admin")).toBe(true);
  expect(canChangeRole("owner", "owner")).toBe(false);
  expect(canChangeRole("admin", "member")).toBe(false);
  expect(canChangeRole("member", "member")).toBe(false);
});

test("role labels", () => expect(["owner", "admin", "member"].map((r) => roleLabel(r as any))).toEqual(["Owner", "Admin", "Member"]));

describe("expiresIn", () => {
  const now = Date.parse("2026-11-10T12:00:00Z");
  const at = (ms: number) => new Date(now + ms).toISOString();
  test("days, hours, minutes and expired", () => {
    expect(expiresIn(at(6.5 * 86_400_000), now)).toBe("in 6 days");
    expect(expiresIn(at(86_400_000), now)).toBe("in 1 day");
    expect(expiresIn(at(5 * 3_600_000), now)).toBe("in 5 hours");
    expect(expiresIn(at(3_600_000), now)).toBe("in 1 hour");
    expect(expiresIn(at(30 * 60_000), now)).toBe("in under an hour");
    expect(expiresIn(at(-1000), now)).toBe("expired");
    expect(expiresIn("garbage", now)).toBe("expired");
  });
});

import { badgeText, describeNotification, NotificationItem } from "./notifications";

const n = (type: string, data: any = {}, extra: Partial<NotificationItem> = {}): NotificationItem => ({
  _id: "1", type, actorName: "Ana", data, createdAt: "2026-11-10T12:00:00Z", ...extra,
});

describe("describeNotification", () => {
  test("assignment is phrased to the recipient and links to the task", () => {
    expect(describeNotification(n("task.created", { title: "Ship", priority: "High", dueDate: "2026-11-20" }, { task: "t1" }))).toEqual({
      lead: "assigned you", subject: "Ship", to: "/task-page?id=t1", detail: "High priority · due Nov 20, 2026",
    });
  });
  test("task notifications open the task in its project's drawer when the project is known", () => {
    const r = describeNotification(n("task.status_changed", { title: "T", from: "To Do", to: "Completed" }, { task: "t1", project: "p9" }));
    expect(r.to).toBe("/project-page?id=p9&task=t1");
  });
  test("reassignment reads the same for everyone involved", () => {
    const r = describeNotification(n("task.reassigned", { title: "T", from: "Ann", to: "Bo" }, { task: "t1", project: "p1" }));
    expect([r.lead, r.subject, r.trail, r.to]).toEqual(["reassigned", "T", "from Ann to Bo", "/project-page?id=p1&task=t1"]);
  });
  test("status changes read 'moved X from A to B'", () => {
    const r = describeNotification(n("task.status_changed", { title: "T", from: "To Do", to: "Completed" }, { task: "t" }));
    expect([r.lead, r.subject, r.trail]).toEqual(["moved", "T", "from To Do to Completed"]);
  });
  test("being added to a project links to that project", () => {
    const r = describeNotification(n("member.added", {}, { project: "p1", projectName: "Relaunch" }));
    expect(r).toEqual({ lead: "added you to", subject: "Relaunch", to: "/project-page?id=p1" });
  });
  test("removal and deletion have no destination (it no longer exists or is off-limits)", () => {
    expect(describeNotification(n("member.removed", {}, { project: "p", projectName: "R" })).to).toBeUndefined();
    expect(describeNotification(n("task.deleted", { title: "Old" }, { task: "t" })).to).toBeUndefined();
  });
  test("task updates list which fields changed", () => {
    expect(describeNotification(n("task.updated", { title: "T", changes: [{ field: "priority" }, { field: "due date" }] })).detail).toBe("priority, due date");
  });
  test("unknown types degrade gracefully", () => expect(describeNotification(n("x.y")).lead).toBe("made a change"));
});

test("badgeText caps large counts", () => {
  expect(badgeText(3)).toBe("3");
  expect(badgeText(99)).toBe("99");
  expect(badgeText(100)).toBe("99+");
});

describe("workspace notifications", () => {
  test("an invitation says who invited you to what, as which role, and points at the dashboard where it can be accepted", () => {
    const r = describeNotification(n("workspace.invited", { workspaceName: "Acme Co", role: "admin" }));
    expect(r).toEqual({ lead: "invited you to join", subject: "Acme Co", trail: "as an admin", to: "/dashboard" });
    expect(describeNotification(n("workspace.invited", { workspaceName: "Acme Co", role: "member" })).trail).toBe("as a member");
  });
  test("someone joining has no destination", () => {
    const r = describeNotification(n("workspace.joined", { workspaceName: "Acme Co", role: "member" }));
    expect(r).toEqual({ lead: "joined", subject: "Acme Co", trail: "as a member" });
  });
});

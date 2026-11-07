import moment from "moment";
import { describeActivity, groupByDay, ActivityItem } from "./activity";

const item = (verb: string, data: any = {}, extra: Partial<ActivityItem> = {}): ActivityItem => ({
  _id: "1", verb, category: "task", actorName: "Ana", data, createdAt: "2026-11-10T12:00:00Z", ...extra,
});

describe("describeActivity", () => {
  test("status change reads naturally and links to the task", () => {
    expect(describeActivity(item("task.status_changed", { title: "Ship", from: "To Do", to: "In Review" }, { task: "t1" }))).toEqual({
      lead: "moved", subject: "Ship", taskId: "t1", trail: "from To Do to In Review",
    });
  });
  test("a deleted task is named but not linked", () => {
    const r = describeActivity(item("task.deleted", { title: "Old" }, { task: "t1" }));
    expect(r.subject).toBe("Old");
    expect(r.taskId).toBeUndefined();
  });
  test("task updates list every change", () => {
    const r = describeActivity(item("task.updated", { title: "T", changes: [
      { field: "priority", from: "Low", to: "High" }, { field: "title", from: "A", to: "B" }, { field: "description" },
    ] }));
    expect(r.detail).toBe("priority: Low → High · title: “A” → “B” · description edited");
  });
  test("due date changes are formatted as dates", () => {
    const r = describeActivity(item("task.updated", { title: "T", changes: [{ field: "due date", from: "2026-11-20", to: null }] }));
    expect(r.detail).toBe("due date: Nov 20, 2026 → none");
  });
  test("task creation mentions the assignee and priority/due date", () => {
    const r = describeActivity(item("task.created", { title: "T", assigneeName: "Bo", priority: "High", dueDate: "2026-11-20" }, { task: "t" }));
    expect(r.trail).toBe("and assigned it to Bo");
    expect(r.detail).toBe("High priority · due Nov 20, 2026");
  });
  test("long file lists are summarised", () => {
    expect(describeActivity(item("media.added", { names: ["a", "b", "c", "d"], scope: "project" })).lead).toBe("attached a, b and 2 more to the project");
    expect(describeActivity(item("media.added", { names: ["a.png"], scope: "task", title: "T" }, { task: "t" }))).toMatchObject({ lead: "attached a.png to", subject: "T", taskId: "t" });
  });
  test("member removal reports handed-over tasks with correct pluralisation", () => {
    expect(describeActivity(item("member.removed", { memberName: "Bo", reassigned: 1 })).detail).toBe("1 task handed to the project manager");
    expect(describeActivity(item("member.removed", { memberName: "Bo", reassigned: 3 })).detail).toBe("3 tasks handed to the project manager");
    expect(describeActivity(item("member.removed", { memberName: "Bo", reassigned: 0 })).detail).toBeUndefined();
  });
  test("unknown verbs degrade gracefully", () => {
    expect(describeActivity(item("something.new")).lead).toBe("made a change");
  });
});

describe("groupByDay", () => {
  const now = moment("2026-11-10T15:00:00");
  test("groups consecutive items under Today / Yesterday / date headings", () => {
    const g = groupByDay([
      item("a", {}, { _id: "1", createdAt: moment("2026-11-10T09:00:00").toISOString() }),
      item("a", {}, { _id: "2", createdAt: moment("2026-11-10T08:00:00").toISOString() }),
      item("a", {}, { _id: "3", createdAt: moment("2026-11-09T20:00:00").toISOString() }),
      item("a", {}, { _id: "4", createdAt: moment("2026-11-03T10:00:00").toISOString() }),
    ], now);
    expect(g.map((x) => [x.label, x.items.length])).toEqual([["Today", 2], ["Yesterday", 1], ["Tue, Nov 3", 1]]);
  });
  test("empty input gives no groups", () => expect(groupByDay([], now)).toEqual([]));
});

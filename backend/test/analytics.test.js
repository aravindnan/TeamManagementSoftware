const { computeAnalytics, percentile, mondayOf } = require("../utils/analytics");

// Wednesday 11 Nov 2026, noon UTC. That week started Monday 9 Nov.
const NOW = Date.parse("2026-11-11T12:00:00Z");
const iso = (s) => new Date(s).toISOString();
const DAY = 86400000;

let n = 0;
const task = (o = {}) => ({
  _id: `t${++n}`, taskTitle: `Task ${n}`, taskStatus: "To Do", taskPriority: "Medium", assignedTo: "u1",
  createdAt: iso("2026-11-01T00:00:00Z"), updatedAt: iso("2026-11-01T00:00:00Z"), ...o,
});
const done = (completedAt, o = {}) => task({ taskStatus: "Completed", completedAt: iso(completedAt), ...o });

describe("helpers", () => {
  test("mondayOf maps any weekday, including Sunday, to the preceding Monday 00:00 UTC", () => {
    const monday = Date.parse("2026-11-09T00:00:00Z");
    expect(mondayOf(Date.parse("2026-11-09T00:00:00Z"))).toBe(monday);
    expect(mondayOf(Date.parse("2026-11-11T12:00:00Z"))).toBe(monday);
    expect(mondayOf(Date.parse("2026-11-15T23:59:59Z"))).toBe(monday); // Sunday
    expect(mondayOf(Date.parse("2026-11-16T00:00:00Z"))).toBe(monday + 7 * DAY);
  });
  test("percentile uses nearest rank", () => {
    expect(percentile([1, 2, 3, 4, 10], 0.5)).toBe(3);
    expect(percentile([1, 2, 3, 4, 10], 0.85)).toBe(10);
    expect(percentile([7], 0.85)).toBe(7);
    expect(percentile([], 0.5)).toBeNull();
  });
});

describe("throughput", () => {
  test("buckets completions by week, honouring the Monday boundary", () => {
    const tasks = [
      done("2026-11-10T09:00:00Z"),
      done("2026-11-09T00:00:00Z"), // exactly Monday 00:00 -> this week
      done("2026-11-08T23:59:00Z"), // Sunday before -> last week
      done("2026-10-27T10:00:00Z"),
      done("2026-09-01T10:00:00Z"), // outside the window
      task({ taskStatus: "In Progress" }),
    ];
    const t = computeAnalytics(tasks, {}, { now: NOW, weeks: 4 }).throughput;
    expect(t.map((w) => w.weekStart)).toEqual(["2026-10-19", "2026-10-26", "2026-11-02", "2026-11-09"]);
    expect(t.map((w) => w.completed)).toEqual([0, 1, 1, 2]);
  });
  test("a completed task without completedAt falls back to its last update", () => {
    const legacy = task({ taskStatus: "Completed", updatedAt: iso("2026-11-10T00:00:00Z") });
    expect(computeAnalytics([legacy], {}, { now: NOW, weeks: 1 }).throughput[0].completed).toBe(1);
  });
});

describe("cycle time", () => {
  const withDays = (d) => done(new Date(Date.parse("2026-11-01T00:00:00Z") + d * DAY), { createdAt: iso("2026-11-01T00:00:00Z") });
  test("median, p85 and range over finished tasks", () => {
    const r = computeAnalytics([1, 2, 3, 4, 10].map(withDays), {}, { now: NOW }).cycleTime;
    expect(r).toEqual({ sampleSize: 5, median: 3, p85: 10, fastest: 1, slowest: 10 });
  });
  test("no finished tasks gives nulls rather than NaN", () => {
    const r = computeAnalytics([task()], {}, { now: NOW }).cycleTime;
    expect(r).toEqual({ sampleSize: 0, median: null, p85: null, fastest: null, slowest: null });
  });
  test("instant completions are floored so they do not read as zero days", () => {
    expect(computeAnalytics([withDays(0)], {}, { now: NOW }).cycleTime.fastest).toBe(0.1);
  });
});

describe("burn-up", () => {
  test("is cumulative per day, including work created before the window", () => {
    const tasks = [
      task({ createdAt: iso("2026-11-08T10:00:00Z") }),
      task({ createdAt: iso("2026-11-10T10:00:00Z") }),
      done("2026-11-10T12:00:00Z", { createdAt: iso("2026-11-08T10:00:00Z") }),
    ];
    const b = computeAnalytics(tasks, {}, { now: NOW, days: 3 }).burnup;
    expect(b.map((d) => d.date)).toEqual(["2026-11-09", "2026-11-10", "2026-11-11"]);
    expect(b.map((d) => [d.created, d.completed])).toEqual([[2, 0], [3, 1], [3, 1]]);
  });
});

describe("aging work in progress", () => {
  test("lists only in-progress and in-review work, longest in column first, using the activity log", () => {
    const a = task({ _id: "a", taskStatus: "In Progress", createdAt: iso("2026-11-10T12:00:00Z") });
    const b = task({ _id: "b", taskStatus: "In Review", createdAt: iso("2026-11-01T12:00:00Z") });
    const c = task({ _id: "c", taskStatus: "To Do" });
    const d = done("2026-11-05T00:00:00Z", { _id: "d" });
    const moved = { a: NOW - 5 * DAY, b: NOW - 1 * DAY }; // a has sat longest in its column despite being newer
    const aging = computeAnalytics([a, b, c, d], moved, { now: NOW }).aging;
    expect(aging.map((x) => x.taskId)).toEqual(["a", "b"]);
    expect(aging[0]).toMatchObject({ daysInColumn: 5, ageDays: 1 });
    expect(aging[1]).toMatchObject({ daysInColumn: 1, ageDays: 10 });
  });
  test("without activity it falls back to the creation date and is capped", () => {
    const many = Array.from({ length: 12 }, (_, i) => task({ taskStatus: "In Progress", createdAt: iso(NOW - (i + 1) * DAY) }));
    const aging = computeAnalytics(many, {}, { now: NOW, topAging: 5 }).aging;
    expect(aging).toHaveLength(5);
    expect(aging[0].daysInColumn).toBe(12);
  });
});

describe("summary and people", () => {
  test("counts, overdue (end of due day) and completion rate", () => {
    const tasks = [
      task({ taskStatus: "In Progress", dueDate: "2026-11-10" }), // ended 11 Nov 00:00 -> overdue
      task({ taskStatus: "In Progress", dueDate: "2026-11-11" }), // due today -> not overdue yet
      task({ dueDate: undefined }),
      done("2026-11-05T00:00:00Z", { dueDate: "2026-11-01" }), // finished, never overdue
    ];
    expect(computeAnalytics(tasks, {}, { now: NOW }).summary).toEqual({ total: 4, open: 3, completed: 1, overdue: 1, completionRate: 25 });
  });
  test("an empty project is all zeros without NaN", () => {
    const r = computeAnalytics([], {}, { now: NOW, weeks: 2, days: 2 });
    expect(r.summary).toEqual({ total: 0, open: 0, completed: 0, overdue: 0, completionRate: 0 });
    expect(r.throughput.every((w) => w.completed === 0)).toBe(true);
    expect(r.byAssignee).toEqual([]);
  });
  test("per-person counts", () => {
    const tasks = [
      task({ assignedTo: "u1", taskStatus: "In Progress", dueDate: "2026-11-01" }),
      task({ assignedTo: "u1" }),
      done("2026-11-05T00:00:00Z", { assignedTo: "u2" }),
    ];
    const by = computeAnalytics(tasks, {}, { now: NOW }).byAssignee;
    expect(by).toEqual([
      { assignedTo: "u1", open: 2, completed: 0, overdue: 1 },
      { assignedTo: "u2", open: 0, completed: 1, overdue: 0 },
    ]);
  });
});

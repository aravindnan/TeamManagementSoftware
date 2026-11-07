const { assessTask, assessProject, typicalCycle } = require("../utils/risk");

const NOW = Date.parse("2026-11-10T12:00:00Z");
const iso = (s) => new Date(s).toISOString();

const task = (o = {}) => ({
  _id: o._id || "t1",
  taskTitle: "Task",
  taskStatus: "In Progress",
  taskPriority: "Medium",
  assignedTo: "u1",
  dueDate: "2026-12-20",
  createdAt: iso("2026-11-09T12:00:00Z"),
  updatedAt: iso("2026-11-10T09:00:00Z"),
  ...o,
});
const finished = (id, days, priority = "Medium") => ({
  _id: id,
  taskStatus: "Completed",
  taskPriority: priority,
  createdAt: iso("2026-11-01T00:00:00Z"),
  completedAt: iso(new Date(Date.parse("2026-11-01T00:00:00Z") + days * 86400000)),
});
const ctx = (completed = [], openByAssignee = {}) => ({ completed, openByAssignee });

describe("assessTask", () => {
  test("overdue tasks are high risk and say how late", () => {
    const r = assessTask(task({ dueDate: "2026-11-08" }), ctx(), NOW);
    expect(r.level).toBe("high");
    expect(r.score).toBe(70);
    expect(r.reasons[0]).toBe("Overdue by 2 days.");
  });

  test("plenty of time and recent activity is on track", () => {
    const r = assessTask(task(), ctx(), NOW);
    expect(r.level).toBe("on-track");
    expect(r.score).toBe(0);
    expect(r.reasons[0]).toMatch(/^On track/);
  });

  test("unstarted high-priority task due tomorrow is high risk (default estimate)", () => {
    const r = assessTask(task({ taskStatus: "To Do", taskPriority: "High", dueDate: "2026-11-11" }), ctx(), NOW);
    expect(r.level).toBe("high");
    expect(r.score).toBe(65); // 45 schedule + 20 not started near deadline
    expect(r.metrics.estimateSource).toBe("default");
    expect(r.reasons.join(" ")).toMatch(/default for High priority/);
    expect(r.reasons.join(" ")).toMatch(/Not started and due within 2 days/);
  });

  test("learns typical cycle time from finished tasks and explains it", () => {
    const completed = [finished("a", 2), finished("b", 2), finished("c", 2)];
    const r = assessTask(task({ dueDate: "2026-11-11", updatedAt: iso("2026-11-05T12:00:00Z") }), ctx(completed), NOW);
    expect(r.metrics.estimateSource).toBe("same-priority");
    expect(r.metrics.sampleSize).toBe(3);
    expect(r.metrics.typicalCycleDays).toBe(2);
    expect(r.level).toBe("medium"); // 30 tight (1.2d of work in 1.5d) + 15 stale
    expect(r.score).toBe(45);
    expect(r.reasons[0]).toMatch(/^Tight:/);
    expect(r.reasons.join(" ")).toMatch(/typical for 3 similar finished tasks/);
    expect(r.reasons.join(" ")).toMatch(/No activity for 5 days/);
  });

  test("stale work is flagged even with lots of time left", () => {
    const r = assessTask(task({ taskStatus: "In Review", updatedAt: iso("2026-11-02T12:00:00Z") }), ctx(), NOW);
    expect(r.score).toBe(25);
    expect(r.level).toBe("on-track");
    expect(r.reasons).toEqual(["No activity for 8 days."]);
  });

  test("a To Do task is not 'stale' just for being untouched", () => {
    const r = assessTask(task({ taskStatus: "To Do", updatedAt: iso("2026-10-01T00:00:00Z") }), ctx(), NOW);
    expect(r.reasons.join(" ")).not.toMatch(/No activity/);
  });

  test("an overloaded assignee adds risk only when the deadline is within a week", () => {
    const soon = assessTask(task({ dueDate: "2026-11-15" }), ctx([], { u1: 4 }), NOW);
    expect(soon.reasons.join(" ")).toMatch(/Assignee has 4 open tasks/);
    const later = assessTask(task({ dueDate: "2026-12-20" }), ctx([], { u1: 4 }), NOW);
    expect(later.reasons.join(" ")).not.toMatch(/Assignee has/);
  });

  test("tasks without a due date are unscheduled, not scored", () => {
    const r = assessTask(task({ dueDate: undefined }), ctx(), NOW);
    expect(r.level).toBe("unscheduled");
    expect(r.score).toBe(0);
    expect(r.metrics).toBeNull();
  });

  test("score never exceeds 100", () => {
    const r = assessTask(task({ dueDate: "2026-01-01", updatedAt: iso("2026-01-01T00:00:00Z") }), ctx([], { u1: 9 }), NOW);
    expect(r.score).toBe(100);
  });
});

describe("typicalCycle", () => {
  test("needs at least 3 samples, otherwise falls back", () => {
    expect(typicalCycle(task(), [finished("a", 2), finished("b", 4)]).source).toBe("default");
  });
  test("uses the median, not the mean (one slow outlier does not skew it)", () => {
    const c = typicalCycle(task(), [finished("a", 2), finished("b", 3), finished("c", 40)]);
    expect(c.days).toBe(3);
  });
  test("falls back to all priorities when the same priority has too few", () => {
    const c = typicalCycle(task({ taskPriority: "High" }), [finished("a", 2), finished("b", 2), finished("c", 2)]);
    expect(c.source).toBe("all-priorities");
  });
});

describe("assessProject", () => {
  test("ignores completed tasks, ranks by severity and summarises", () => {
    const tasks = [
      task({ _id: "ok", dueDate: "2026-12-20" }),
      task({ _id: "late", dueDate: "2026-11-01" }),
      task({ _id: "nodate", dueDate: undefined }),
      { ...finished("done", 2), assignedTo: "u1" },
    ];
    const r = assessProject(tasks, NOW);
    expect(r.summary).toEqual({ openTasks: 3, high: 1, medium: 0, onTrack: 1, unscheduled: 1 });
    expect(r.tasks.map((t) => t.taskId)).toEqual(["late", "ok", "nodate"]);
  });
});

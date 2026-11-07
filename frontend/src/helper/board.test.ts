import { canMoveTask, groupTasksByStatus, isOverdue, withStatus } from "./board";

describe("groupTasksByStatus", () => {
  test("buckets by status and keeps every column present", () => {
    const g = groupTasksByStatus([
      { _id: "1", taskStatus: "To Do" },
      { _id: "2", taskStatus: "Completed" },
      { _id: "3", taskStatus: "In Progress" },
      { _id: "4", taskStatus: "In Progress" },
    ]);
    expect(g["To Do"].map((t) => t._id)).toEqual(["1"]);
    expect(g["In Progress"].map((t) => t._id)).toEqual(["3", "4"]);
    expect(g["In Review"]).toEqual([]);
    expect(g["Completed"].map((t) => t._id)).toEqual(["2"]);
  });
  test("unknown statuses land in To Do instead of vanishing", () => {
    expect(groupTasksByStatus([{ _id: "x", taskStatus: "Archived" }])["To Do"]).toHaveLength(1);
  });
});

describe("canMoveTask", () => {
  const project = { projectManager: { _id: "m" } };
  const task = { assignedTo: "a", assignedBy: "b" };
  test("manager, assignee and creator can move", () => {
    expect(canMoveTask(task, project, "m")).toBe(true);
    expect(canMoveTask(task, project, "a")).toBe(true);
    expect(canMoveTask(task, project, "b")).toBe(true);
  });
  test("others and anonymous cannot", () => {
    expect(canMoveTask(task, project, "z")).toBe(false);
    expect(canMoveTask(task, project, undefined)).toBe(false);
  });
});

describe("isOverdue", () => {
  const now = new Date("2026-11-10T12:00:00");
  test("past due and open is overdue", () => expect(isOverdue({ taskStatus: "In Progress", dueDate: "2026-11-09" }, now)).toBe(true));
  test("due today is not overdue", () => expect(isOverdue({ taskStatus: "To Do", dueDate: "2026-11-10" }, now)).toBe(false));
  test("completed or undated is never overdue", () => {
    expect(isOverdue({ taskStatus: "Completed", dueDate: "2020-01-01" }, now)).toBe(false);
    expect(isOverdue({ taskStatus: "To Do" }, now)).toBe(false);
  });
});

describe("withStatus", () => {
  test("changes one task immutably", () => {
    const tasks = [{ _id: "1", taskStatus: "To Do" }, { _id: "2", taskStatus: "To Do" }];
    const next = withStatus(tasks, "2", "In Review");
    expect(next[1].taskStatus).toBe("In Review");
    expect(tasks[1].taskStatus).toBe("To Do");
    expect(next[0]).toBe(tasks[0]);
  });
});

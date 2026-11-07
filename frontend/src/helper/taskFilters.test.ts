import { filterAndSortTasks } from "./taskFilters";

const tasks = [
  { _id: "a1", taskTitle: "Write docs", taskStatus: "In Progress", taskPriority: "Low", dueDate: "2026-12-01" },
  { _id: "b2", taskTitle: "Fix login bug", taskStatus: "Completed", taskPriority: "High", dueDate: "2026-11-10" },
  { _id: "c3", taskTitle: "Deploy site", taskStatus: "In Progress", taskPriority: "High" },
  { _id: "d4", taskTitle: "Design logo", taskStatus: "In Progress", taskPriority: "Medium", dueDate: "2026-11-05" },
];
const base = { search: "", status: "all", priority: "all", sort: "default" } as const;
const ids = (r: any[]) => r.map((t) => t._id);

describe("filterAndSortTasks", () => {
  test("default keeps creation order without mutating input", () => {
    expect(ids(filterAndSortTasks(tasks, base))).toEqual(["a1", "b2", "c3", "d4"]);
    expect(ids(tasks)).toEqual(["a1", "b2", "c3", "d4"]);
  });
  test("searches title and id, case-insensitively", () => {
    expect(ids(filterAndSortTasks(tasks, { ...base, search: "LOGIN" }))).toEqual(["b2"]);
    expect(ids(filterAndSortTasks(tasks, { ...base, search: "c3" }))).toEqual(["c3"]);
  });
  test("combines status and priority filters", () => {
    expect(ids(filterAndSortTasks(tasks, { ...base, status: "In Progress", priority: "High" }))).toEqual(["c3"]);
    expect(ids(filterAndSortTasks(tasks, { ...base, status: "Completed" }))).toEqual(["b2"]);
  });
  test("sorts by due date with undated tasks last", () => {
    expect(ids(filterAndSortTasks(tasks, { ...base, sort: "due" }))).toEqual(["d4", "b2", "a1", "c3"]);
  });
  test("sorts by priority, ties broken by due date", () => {
    expect(ids(filterAndSortTasks(tasks, { ...base, sort: "priority" }))).toEqual(["b2", "c3", "d4", "a1"]);
  });
});

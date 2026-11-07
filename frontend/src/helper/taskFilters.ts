export type StatusFilter = "all" | "completed" | "in-progress";
export type PriorityFilter = "all" | "High" | "Medium" | "Low";
export type SortMode = "default" | "due" | "priority";

interface Options {
  search: string;
  status: StatusFilter;
  priority: PriorityFilter;
  sort: SortMode;
}

const PRIORITY_RANK: Record<string, number> = { High: 0, Medium: 1, Low: 2 };

/** Pure filter + sort used by the task list. `default` keeps the original (creation) order. */
export function filterAndSortTasks(tasks: any[], { search, status, priority, sort }: Options): any[] {
  const q = search.trim().toLowerCase();

  const result = tasks.filter((t) => {
    if (q && !(String(t.taskTitle || "").toLowerCase().includes(q) || String(t._id || "").toLowerCase().includes(q))) return false;
    if (status === "completed" && t.taskStatus !== "Completed") return false;
    if (status === "in-progress" && t.taskStatus !== "In Progress") return false;
    if (priority !== "all" && t.taskPriority !== priority) return false;
    return true;
  });

  const time = (t: any) => {
    const v = Date.parse(t.dueDate);
    return Number.isNaN(v) ? Infinity : v; // tasks without a due date go last
  };

  if (sort === "due") return [...result].sort((a, b) => time(a) - time(b));
  if (sort === "priority")
    return [...result].sort((a, b) => (PRIORITY_RANK[a.taskPriority] ?? 3) - (PRIORITY_RANK[b.taskPriority] ?? 3) || time(a) - time(b));
  return result;
}

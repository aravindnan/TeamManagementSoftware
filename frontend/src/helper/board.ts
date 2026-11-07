import { TASK_STATUSES, TaskStatus } from "../Constants";

const idOf = (v: any): string => String(v && v._id ? v._id : v ?? "");

/** Buckets tasks by status. Unknown/legacy statuses fall back to "To Do" so nothing disappears. */
export function groupTasksByStatus(tasks: any[]): Record<TaskStatus, any[]> {
  const groups = Object.fromEntries(TASK_STATUSES.map((s) => [s, [] as any[]])) as Record<TaskStatus, any[]>;
  for (const task of tasks) {
    const status = (TASK_STATUSES as readonly string[]).includes(task.taskStatus) ? (task.taskStatus as TaskStatus) : "To Do";
    groups[status].push(task);
  }
  return groups;
}

/** Mirrors the server rule: manager, assignee or creator may move a task. */
export function canMoveTask(task: any, project: any, userId?: string): boolean {
  if (!userId) return false;
  return [project?.projectManager, task?.assignedTo, task?.assignedBy].some((p) => idOf(p) === userId);
}

export const isOverdue = (task: any, now: Date = new Date()): boolean => {
  if (task.taskStatus === "Completed" || !task.dueDate) return false;
  const due = new Date(task.dueDate);
  if (Number.isNaN(due.getTime())) return false;
  due.setHours(23, 59, 59, 999); // due "today" is not overdue until the day ends
  return due.getTime() < now.getTime();
};

/** Returns a copy of `tasks` with one task's status replaced (used for optimistic moves). */
export const withStatus = (tasks: any[], taskId: string, status: TaskStatus): any[] =>
  tasks.map((t) => (t._id === taskId ? { ...t, taskStatus: status } : t));

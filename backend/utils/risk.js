// Deadline risk assessment. Deliberately a transparent heuristic, not a black box:
// every point of the score comes from a named factor that is returned to the user as a reason.

const DAY = 24 * 60 * 60 * 1000;

// Used until a project has enough completed tasks to learn from.
const DEFAULT_CYCLE_DAYS = { High: 3, Medium: 5, Low: 7 };
const MIN_SAMPLES = 3;

// How much of the typical cycle time is still ahead, by board column.
const REMAINING_FRACTION = { "To Do": 1, "In Progress": 0.6, "In Review": 0.2 };

const STALE_DAYS = 4;
const VERY_STALE_DAYS = 7;
const OVERLOAD_OPEN_TASKS = 4;

const HIGH_THRESHOLD = 60;
const MEDIUM_THRESHOLD = 35;

const round1 = (n) => Math.round(n * 10) / 10;
const idOf = (v) => String(v && v._id ? v._id : v);

const median = (xs) => {
  const s = [...xs].sort((a, b) => a - b);
  const mid = Math.floor(s.length / 2);
  return s.length % 2 ? s[mid] : (s[mid - 1] + s[mid]) / 2;
};

// "2026-11-20" means the whole of that day, so the deadline is the end of it.
const dueEnd = (dueDate) => {
  const t = Date.parse(dueDate);
  if (Number.isNaN(t)) return null;
  return /^\d{4}-\d{2}-\d{2}$/.test(String(dueDate).trim()) ? t + DAY : t;
};

const createdAtOf = (task) => {
  const t = Date.parse(task.createdAt || task.assignedOn);
  return Number.isNaN(t) ? null : t;
};

const lastActivityOf = (task) => {
  const t = Date.parse(task.updatedAt || task.createdAt || task.assignedOn);
  return Number.isNaN(t) ? null : t;
};

/**
 * Typical time-to-complete, learned from the project's own finished tasks.
 * Prefers tasks of the same priority; falls back to all priorities, then to fixed defaults.
 */
function typicalCycle(task, completed) {
  const days = (t) => {
    const start = createdAtOf(t);
    const end = Date.parse(t.completedAt || t.updatedAt);
    return start && !Number.isNaN(end) ? Math.max((end - start) / DAY, 0.1) : null;
  };
  const durations = (list) => list.map(days).filter((d) => d !== null);

  const samePriority = durations(completed.filter((t) => t.taskPriority === task.taskPriority));
  if (samePriority.length >= MIN_SAMPLES) return { days: median(samePriority), samples: samePriority.length, source: "same-priority" };

  const all = durations(completed);
  if (all.length >= MIN_SAMPLES) return { days: median(all), samples: all.length, source: "all-priorities" };

  return { days: DEFAULT_CYCLE_DAYS[task.taskPriority] ?? DEFAULT_CYCLE_DAYS.Medium, samples: 0, source: "default" };
}

const plural = (n, word) => `${n} ${word}${n === 1 ? "" : "s"}`;
const daysText = (d) => (d < 1 ? "under a day" : plural(Math.round(d), "day"));

/** Assess one open task. `ctx` carries the project's completed tasks and open-task counts per assignee. */
function assessTask(task, ctx, now = Date.now()) {
  const deadline = dueEnd(task.dueDate);
  const cycle = typicalCycle(task, ctx.completed);
  const lastActivity = lastActivityOf(task);
  const staleDays = lastActivity ? Math.max((now - lastActivity) / DAY, 0) : 0;

  const base = {
    taskId: String(task._id),
    taskTitle: task.taskTitle,
    taskStatus: task.taskStatus,
    taskPriority: task.taskPriority,
    assignedTo: idOf(task.assignedTo),
    dueDate: task.dueDate || null,
  };

  if (deadline === null) {
    return { ...base, level: "unscheduled", score: 0, reasons: ["No due date, so deadline risk cannot be judged."], metrics: null };
  }

  const daysLeft = (deadline - now) / DAY;
  const fraction = REMAINING_FRACTION[task.taskStatus] ?? 1;
  const remainingWork = cycle.days * fraction;

  let score = 0;
  const reasons = [];

  // 1) Schedule pressure: is there enough time left for the work that remains?
  if (daysLeft < 0) {
    const late = Math.ceil(-daysLeft);
    score += 60 + Math.min(late * 5, 20);
    reasons.push(`Overdue by ${plural(late, "day")}.`);
  } else {
    const ratio = remainingWork / Math.max(daysLeft, 0.5);
    const basis =
      cycle.source === "default"
        ? `estimated ${daysText(remainingWork)} of work left (default for ${task.taskPriority || "Medium"} priority)`
        : `about ${daysText(remainingWork)} of work left (typical for ${cycle.samples} similar finished tasks)`;
    if (ratio >= 1) {
      score += 45;
      reasons.push(`Due in ${daysText(daysLeft)} but ${basis}.`);
    } else if (ratio >= 0.7) {
      score += 30;
      reasons.push(`Tight: due in ${daysText(daysLeft)} with ${basis}.`);
    } else if (ratio >= 0.4) {
      score += 15;
      reasons.push(`Little slack: due in ${daysText(daysLeft)} with ${basis}.`);
    }
  }

  // 2) Not started and the deadline is close.
  if (task.taskStatus === "To Do" && daysLeft >= 0 && daysLeft <= 2) {
    score += 20;
    reasons.push("Not started and due within 2 days.");
  }

  // 3) No recent activity on something that should be moving.
  if (task.taskStatus !== "To Do") {
    if (staleDays >= VERY_STALE_DAYS) {
      score += 25;
      reasons.push(`No activity for ${plural(Math.floor(staleDays), "day")}.`);
    } else if (staleDays >= STALE_DAYS) {
      score += 15;
      reasons.push(`No activity for ${plural(Math.floor(staleDays), "day")}.`);
    }
  }

  // 4) The assignee is stretched.
  const openForAssignee = ctx.openByAssignee[idOf(task.assignedTo)] || 0;
  if (openForAssignee >= OVERLOAD_OPEN_TASKS && daysLeft <= 7) {
    score += 10;
    reasons.push(`Assignee has ${openForAssignee} open tasks in this project.`);
  }

  score = Math.min(score, 100);
  const level = score >= HIGH_THRESHOLD ? "high" : score >= MEDIUM_THRESHOLD ? "medium" : "on-track";
  if (reasons.length === 0) reasons.push(`On track: due in ${daysText(daysLeft)}.`);

  return {
    ...base,
    level,
    score,
    reasons,
    metrics: {
      daysLeft: round1(daysLeft),
      typicalCycleDays: round1(cycle.days),
      sampleSize: cycle.samples,
      estimateSource: cycle.source,
      staleDays: round1(staleDays),
    },
  };
}

/** Assess every open task of a project; most at-risk first. */
function assessProject(tasks, now = Date.now()) {
  const completed = tasks.filter((t) => t.taskStatus === "Completed");
  const open = tasks.filter((t) => t.taskStatus !== "Completed");
  const openByAssignee = {};
  for (const t of open) openByAssignee[idOf(t.assignedTo)] = (openByAssignee[idOf(t.assignedTo)] || 0) + 1;

  const ctx = { completed, openByAssignee };
  const assessed = open.map((t) => assessTask(t, ctx, now));
  const rank = { high: 0, medium: 1, "on-track": 2, unscheduled: 3 };
  assessed.sort((a, b) => rank[a.level] - rank[b.level] || b.score - a.score);

  const count = (level) => assessed.filter((a) => a.level === level).length;
  return {
    generatedAt: new Date(now).toISOString(),
    summary: {
      openTasks: open.length,
      high: count("high"),
      medium: count("medium"),
      onTrack: count("on-track"),
      unscheduled: count("unscheduled"),
    },
    tasks: assessed,
  };
}

module.exports = { assessTask, assessProject, typicalCycle, dueEnd };

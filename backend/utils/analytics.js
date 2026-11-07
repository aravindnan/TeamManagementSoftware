// Flow metrics for one project. Pure functions over task rows, so they are easy to test with a fixed clock.
const { dueEnd } = require("./risk");

const DAY = 24 * 60 * 60 * 1000;
const idOf = (v) => String(v && v._id ? v._id : v);
const round1 = (n) => Math.round(n * 10) / 10;
const isoDate = (t) => new Date(t).toISOString().slice(0, 10);

const startOfUtcDay = (t) => Math.floor(t / DAY) * DAY;
const mondayOf = (t) => {
  const day = startOfUtcDay(t);
  const dow = (new Date(day).getUTCDay() + 6) % 7; // Monday = 0
  return day - dow * DAY;
};

const time = (v) => {
  const t = Date.parse(v);
  return Number.isNaN(t) ? null : t;
};
const createdAtOf = (task) => time(task.createdAt) ?? time(task.assignedOn);
// Tasks completed before completedAt existed fall back to their last update.
const completedAtOf = (task) => (task.taskStatus === "Completed" ? time(task.completedAt) ?? time(task.updatedAt) : null);

/** Nearest-rank percentile of an already-sorted array. */
const percentile = (sorted, p) => (sorted.length ? sorted[Math.max(Math.ceil(p * sorted.length) - 1, 0)] : null);

/**
 * @param tasks            lean task documents of the project
 * @param statusChangedAt  { [taskId]: ms } when each task last changed column (from the activity log)
 * @param opts             { now, weeks, days, topAging }
 */
function computeAnalytics(tasks, statusChangedAt = {}, { now = Date.now(), weeks = 8, days = 30, topAging = 8 } = {}) {
  const completed = tasks.filter((t) => t.taskStatus === "Completed");
  const open = tasks.filter((t) => t.taskStatus !== "Completed");

  // ---- summary
  const overdue = open.filter((t) => {
    const end = dueEnd(t.dueDate);
    return end !== null && end < now;
  });
  const summary = {
    total: tasks.length,
    open: open.length,
    completed: completed.length,
    overdue: overdue.length,
    completionRate: tasks.length ? Math.round((completed.length / tasks.length) * 100) : 0,
  };

  // ---- cycle time (created -> completed), days
  const durations = completed
    .map((t) => {
      const start = createdAtOf(t);
      const end = completedAtOf(t);
      return start !== null && end !== null ? Math.max((end - start) / DAY, 0.1) : null;
    })
    .filter((d) => d !== null)
    .sort((a, b) => a - b);
  const cycleTime = {
    sampleSize: durations.length,
    median: durations.length ? round1(percentile(durations, 0.5)) : null,
    p85: durations.length ? round1(percentile(durations, 0.85)) : null,
    fastest: durations.length ? round1(durations[0]) : null,
    slowest: durations.length ? round1(durations[durations.length - 1]) : null,
  };

  // ---- throughput: tasks completed per week, oldest first, ending with the current week
  const thisMonday = mondayOf(now);
  const throughput = Array.from({ length: weeks }, (_, i) => {
    const start = thisMonday - (weeks - 1 - i) * 7 * DAY;
    const count = completed.filter((t) => {
      const c = completedAtOf(t);
      return c !== null && c >= start && c < start + 7 * DAY;
    }).length;
    return { weekStart: isoDate(start), completed: count };
  });

  // ---- burn-up: cumulative created vs completed per day
  const today = startOfUtcDay(now);
  const burnup = Array.from({ length: days }, (_, i) => {
    const dayEnd = today - (days - 1 - i) * DAY + DAY;
    return {
      date: isoDate(dayEnd - DAY),
      created: tasks.filter((t) => {
        const c = createdAtOf(t);
        return c !== null && c < dayEnd;
      }).length,
      completed: completed.filter((t) => {
        const c = completedAtOf(t);
        return c !== null && c < dayEnd;
      }).length,
    };
  });

  // ---- aging work in progress: longest-sitting first
  const aging = open
    .filter((t) => t.taskStatus === "In Progress" || t.taskStatus === "In Review")
    .map((t) => {
      const created = createdAtOf(t) ?? now;
      const since = statusChangedAt[idOf(t._id)] ?? created;
      return {
        taskId: idOf(t._id),
        taskTitle: t.taskTitle,
        taskStatus: t.taskStatus,
        assignedTo: idOf(t.assignedTo),
        ageDays: round1(Math.max((now - created) / DAY, 0)),
        daysInColumn: round1(Math.max((now - since) / DAY, 0)),
      };
    })
    .sort((a, b) => b.daysInColumn - a.daysInColumn)
    .slice(0, topAging);

  // ---- per person
  const people = {};
  const person = (id) => (people[id] = people[id] || { assignedTo: id, open: 0, completed: 0, overdue: 0 });
  open.forEach((t) => (person(idOf(t.assignedTo)).open += 1));
  completed.forEach((t) => (person(idOf(t.assignedTo)).completed += 1));
  overdue.forEach((t) => (person(idOf(t.assignedTo)).overdue += 1));
  const byAssignee = Object.values(people).sort((a, b) => b.open - a.open || b.completed - a.completed);

  return { generatedAt: new Date(now).toISOString(), summary, cycleTime, throughput, burnup, aging, byAssignee };
}

module.exports = { computeAnalytics, percentile, mondayOf };

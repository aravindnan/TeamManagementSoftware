import moment from "moment";

export interface ActivityItem {
  _id: string;
  verb: string;
  category: "project" | "task" | "comment" | "file" | "member";
  actorName: string;
  task?: string;
  data: any;
  createdAt: string;
}

export interface ActivityText {
  /** Text before the linked subject, after the actor's name. */
  lead: string;
  /** Task title or person's name shown emphasised (linked to the task when `taskId` is set). */
  subject?: string;
  /** Text after the subject. */
  trail?: string;
  /** Secondary line: comment excerpt, field changes, ... */
  detail?: string;
  taskId?: string;
}

const quote = (s: any) => `“${s}”`;
const fmtDate = (d: any) => (d ? moment(d).format("MMM D, YYYY") : "none");

const fileList = (names: string[] = []) => {
  if (names.length <= 2) return names.join(" and ") || "a file";
  return `${names.slice(0, 2).join(", ")} and ${names.length - 2} more`;
};

const describeChange = (c: any, prefix = ""): string => {
  switch (c.field) {
    case "title":
    case "name":
      return `${prefix}${c.field}: ${quote(c.from)} → ${quote(c.to)}`;
    case "due date":
      return `${prefix}due date: ${fmtDate(c.from)} → ${fmtDate(c.to)}`;
    case "labels":
      return `${prefix}labels: ${(c.from || []).join(", ") || "none"} → ${(c.to || []).join(", ") || "none"}`;
    case "estimate":
      return `${prefix}estimate: ${c.from == null ? "none" : `${c.from}h`} → ${c.to == null ? "none" : `${c.to}h`}`;
    case "description":
      return `${prefix}description edited`;
    default:
      return `${prefix}${c.field}: ${c.from ?? "none"} → ${c.to ?? "none"}`;
  }
};

/** Turns one log entry into display parts. Unknown verbs degrade to a neutral sentence instead of throwing. */
export function describeActivity(item: ActivityItem): ActivityText {
  const d = item.data || {};
  const taskId = item.task;
  switch (item.verb) {
    case "project.created":
      return { lead: "created the project", subject: d.name };
    case "project.updated":
      return { lead: "updated the project", detail: (d.changes || []).map((c: any) => describeChange(c)).join(" · ") };
    case "task.created":
      return {
        lead: "created task",
        subject: d.title,
        taskId,
        trail: d.assigneeName ? `and assigned it to ${d.assigneeName}` : undefined,
        detail: [d.priority && `${d.priority} priority`, d.dueDate && `due ${fmtDate(d.dueDate)}`].filter(Boolean).join(" · ") || undefined,
      };
    case "task.status_changed":
      return { lead: "moved", subject: d.title, taskId, trail: `from ${d.from} to ${d.to}` };
    case "task.updated":
      return { lead: "updated task", subject: d.title, taskId, detail: (d.changes || []).map((c: any) => describeChange(c)).join(" · ") };
    case "task.reassigned":
      return { lead: "reassigned", subject: d.title, taskId, trail: `from ${d.from} to ${d.to}` };
    case "task.deleted":
      return { lead: "deleted task", subject: d.title }; // gone, so no link
    case "comment.project":
      return { lead: "commented on the project", detail: quote(d.excerpt) };
    case "comment.task":
      return { lead: "commented on", subject: d.title, taskId, detail: quote(d.excerpt) };
    case "media.added":
      return d.scope === "task"
        ? { lead: `attached ${fileList(d.names)} to`, subject: d.title, taskId }
        : { lead: `attached ${fileList(d.names)} to the project` };
    case "media.removed":
      return d.scope === "task"
        ? { lead: `removed ${fileList(d.names)} from`, subject: d.title, taskId }
        : { lead: `removed ${fileList(d.names)} from the project` };
    case "member.added":
      return { lead: "added", subject: d.memberName, trail: "to the project" };
    case "member.removed":
      return {
        lead: "removed",
        subject: d.memberName,
        trail: "from the project",
        detail: d.reassigned ? `${d.reassigned} task${d.reassigned === 1 ? "" : "s"} handed to the project manager` : undefined,
      };
    default:
      return { lead: "made a change" };
  }
}

/** Buckets (already newest-first) items under "Today" / "Yesterday" / a date heading. */
export function groupByDay(items: ActivityItem[], now: moment.Moment = moment()): { label: string; items: ActivityItem[] }[] {
  const groups: { label: string; items: ActivityItem[] }[] = [];
  for (const item of items) {
    const m = moment(item.createdAt);
    const label = m.isSame(now, "day") ? "Today" : m.isSame(now.clone().subtract(1, "day"), "day") ? "Yesterday" : m.format("ddd, MMM D");
    const last = groups[groups.length - 1];
    if (last && last.label === label) last.items.push(item);
    else groups.push({ label, items: [item] });
  }
  return groups;
}

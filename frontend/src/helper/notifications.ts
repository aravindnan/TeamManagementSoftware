import moment from "moment";

export interface NotificationItem {
  _id: string;
  type: string;
  actorName: string;
  project?: string;
  projectName?: string;
  task?: string;
  data: any;
  readAt?: string;
  createdAt: string;
}

export interface NotificationText {
  lead: string;
  subject?: string;
  trail?: string;
  detail?: string;
  /** In-app route to open when the notification is clicked; absent when the target no longer exists. */
  to?: string;
}

const quote = (s: any) => `“${s}”`;
// Opens the task in its project's drawer when we know the project, otherwise on the task's own page.
const taskLink = (n: NotificationItem) =>
  n.task ? (n.project ? `/project-page?id=${n.project}&task=${n.task}` : `/task-page?id=${n.task}`) : undefined;

/** Phrases an event from the *recipient's* point of view ("assigned you ..."). */
export function describeNotification(n: NotificationItem): NotificationText {
  const d = n.data || {};
  switch (n.type) {
    case "task.created":
      return {
        lead: "assigned you",
        subject: d.title,
        to: taskLink(n),
        detail: [d.priority && `${d.priority} priority`, d.dueDate && `due ${moment(d.dueDate).format("MMM D, YYYY")}`].filter(Boolean).join(" · ") || undefined,
      };
    case "task.status_changed":
      return { lead: "moved", subject: d.title, trail: `from ${d.from} to ${d.to}`, to: taskLink(n) };
    case "task.updated":
      return { lead: "updated", subject: d.title, to: taskLink(n), detail: (d.changes || []).map((c: any) => c.field).join(", ") || undefined };
    case "comment.task":
      return { lead: "commented on", subject: d.title, to: taskLink(n), detail: quote(d.excerpt) };
    case "task.reassigned":
      return { lead: "reassigned", subject: d.title, trail: `from ${d.from} to ${d.to}`, to: taskLink(n) };
    case "task.deleted":
      return { lead: "deleted task", subject: d.title };
    case "member.added":
      return { lead: "added you to", subject: n.projectName, to: n.project ? `/project-page?id=${n.project}` : undefined };
    case "member.removed":
      return { lead: "removed you from", subject: n.projectName };
    default:
      return { lead: "made a change" };
  }
}

/** Badge text: caps large counts so the pill never grows unbounded. */
export const badgeText = (count: number): string => (count > 99 ? "99+" : String(count));

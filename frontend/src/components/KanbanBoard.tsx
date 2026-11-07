import React, { useMemo, useRef, useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { qk } from "../queries/keys";
import TaskLink from "./TaskLink";
import moment from "moment";
import { TASK_STATUSES, TaskStatus } from "../Constants";
import { canMoveTask, groupTasksByStatus, isOverdue, withStatus } from "../helper/board";
import { changeTaskStatus } from "../services/taskServices";
import { errorMessage } from "../services/apiClient";
import RiskChip from "./RiskChip";

const COLUMN_DOT: Record<TaskStatus, string> = {
  "To Do": "bg-inactiveC11",
  "In Progress": "bg-C22",
  "In Review": "bg-C33",
  Completed: "bg-SucessGreen",
};

const PRIORITY_BORDER = (p?: string) =>
  p === "High" ? "border-highPriority" : p === "Medium" ? "border-mediumPriority" : "border-lowPriority";

const initials = (u?: any) => (u ? `${u.firstName?.[0] || ""}${u.lastName?.[0] || ""}`.toUpperCase() : "?");

interface Props {
  project: any;
  me: any;
  /** Deadline risk per task id (from the risk radar); optional. */
  riskByTask?: Record<string, { level: any; reasons: string[] }>;
}

function KanbanBoard({ project, me, riskByTask = {} }: Props) {
  const client = useQueryClient();
  // The tasks live in the project's cache entry (the page behind this dialog reads the same one),
  // so a move shows up everywhere instantly and a rollback undoes it everywhere.
  const tasks: any[] = useMemo(() => project?.allTasks || [], [project?.allTasks]);
  const [dragId, setDragId] = useState<string | null>(null);
  const [overColumn, setOverColumn] = useState<TaskStatus | null>(null);
  const [onlyMine, setOnlyMine] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [announce, setAnnounce] = useState("");
  const errorTimer = useRef<ReturnType<typeof setTimeout>>();

  const members = useMemo(() => {
    const map = new Map<string, any>();
    [project?.projectManager, ...(project?.projectMembers || [])].forEach((m) => m && map.set(String(m._id), m));
    return map;
  }, [project]);

  const visible = useMemo(
    () => (onlyMine ? tasks.filter((t) => String(t.assignedTo) === me?._id) : tasks),
    [tasks, onlyMine, me?._id]
  );
  const columns = useMemo(() => groupTasksByStatus(visible), [visible]);

  const showError = (message: string) => {
    setError(message);
    clearTimeout(errorTimer.current);
    errorTimer.current = setTimeout(() => setError(null), 5000);
  };

  const move = async (taskId: string, to: TaskStatus) => {
    const task = tasks.find((t) => t._id === taskId);
    if (!task || task.taskStatus === to) return;
    if (!canMoveTask(task, project, me?._id)) {
      showError("Only the project manager, the assignee or the task creator can move this task.");
      return;
    }
    const from = task.taskStatus;
    const key = qk.project(project._id);
    const setStatus = (status: TaskStatus) =>
      client.setQueryData(key, (old: any) => (old ? { ...old, allTasks: withStatus(old.allTasks, taskId, status) } : old));

    await client.cancelQueries({ queryKey: key }); // an in-flight refetch must not overwrite the optimistic state
    setStatus(to);
    setAnnounce(`Moved ${task.taskTitle} to ${to}`);
    const res: any = await changeTaskStatus(taskId, to); // on success the cache layer refreshes everything affected
    if (!res?.updateStatus) {
      setStatus(from); // roll back just this task
      setAnnounce(`Could not move ${task.taskTitle}`);
      showError(errorMessage(res, "Could not move the task. It was put back."));
    }
  };

  return (
    <div className="flex flex-col flex-1 min-h-0">
      <div className="flex flex-row flex-wrap items-center justify-between gap-2 pb-2">
        <div className="text-[12px] text-gray-500">{`${visible.length} task${visible.length === 1 ? "" : "s"}`}</div>
        <label className="flex flex-row items-center gap-1 text-[12px] font-semibold text-C11 cursor-pointer select-none">
          <input type="checkbox" checked={onlyMine} onChange={(e) => setOnlyMine(e.target.checked)} />
          Only my tasks
        </label>
      </div>

      {error && (
        <div role="alert" className="mb-2 rounded-[4px] bg-inactiveRed text-highPriority text-[12px] font-semibold px-2 py-1">
          {error}
        </div>
      )}
      <div className="sr-only" aria-live="polite">{announce}</div>

      <div className="grid grid-cols-1 md:grid-cols-4 gap-3 flex-1 min-h-0 overflow-y-auto md:overflow-hidden">
        {TASK_STATUSES.map((status) => {
          const items = columns[status];
          const isOver = overColumn === status && dragId !== null;
          return (
            <section
              key={status}
              aria-label={`${status}, ${items.length} tasks`}
              onDragOver={(e) => {
                if (!dragId) return;
                e.preventDefault();
                e.dataTransfer.dropEffect = "move";
                if (overColumn !== status) setOverColumn(status);
              }}
              onDragLeave={(e) => {
                if (!e.currentTarget.contains(e.relatedTarget as Node)) setOverColumn(null);
              }}
              onDrop={(e) => {
                e.preventDefault();
                const id = e.dataTransfer.getData("text/plain") || dragId;
                setOverColumn(null);
                setDragId(null);
                if (id) move(id, status);
              }}
              className={`flex flex-col min-h-[120px] md:min-h-0 rounded-[8px] p-2 transition-colors ${
                isOver ? "bg-C33" : "bg-C44"
              }`}
            >
              <header className="flex flex-row items-center gap-2 pb-2 text-[12px] font-bold text-C11">
                <span className={`inline-block w-[8px] h-[8px] rounded-full ${COLUMN_DOT[status]}`} aria-hidden />
                <span>{status}</span>
                <span className="ml-auto text-[10px] font-semibold text-gray-500">{items.length}</span>
              </header>

              <div className="flex flex-col gap-2 overflow-y-auto flex-1">
                {items.length === 0 && (
                  <div className="text-[11px] text-gray-400 text-center py-6 select-none">
                    {dragId ? "Drop here" : "No tasks"}
                  </div>
                )}
                {items.map((task) => {
                  const movable = canMoveTask(task, project, me?._id);
                  const assignee = members.get(String(task.assignedTo));
                  const overdue = isOverdue(task);
                  return (
                    <article
                      key={task._id}
                      draggable={movable}
                      onDragStart={(e) => {
                        e.dataTransfer.setData("text/plain", task._id);
                        e.dataTransfer.effectAllowed = "move";
                        setDragId(task._id);
                      }}
                      onDragEnd={() => {
                        setDragId(null);
                        setOverColumn(null);
                      }}
                      className={`bg-white rounded-[6px] border-l-4 ${PRIORITY_BORDER(task.taskPriority)} p-2 shadow-sm ${
                        movable ? "cursor-grab active:cursor-grabbing" : ""
                      } ${dragId === task._id ? "opacity-40" : ""}`}
                    >
                      <TaskLink
                        taskId={task._id}
                        draggable={false}
                        className="block text-[12px] font-semibold text-C11 hover:underline underline-offset-2 break-words"
                      >
                        {task.taskTitle}
                      </TaskLink>
                      {(riskByTask[task._id]?.level === "high" || riskByTask[task._id]?.level === "medium") && (
                        <div className="mt-1">
                          <RiskChip level={riskByTask[task._id].level} reasons={riskByTask[task._id].reasons} />
                        </div>
                      )}
                      <div className="flex flex-row items-center justify-between gap-2 mt-2">
                        <div className="flex flex-row items-center gap-1 min-w-0">
                          <span
                            title={assignee ? `${assignee.firstName} ${assignee.lastName}` : "Unassigned"}
                            className="flex items-center justify-center w-[20px] h-[20px] rounded-full bg-C11 text-white text-[8px] font-semibold shrink-0"
                          >
                            {initials(assignee)}
                          </span>
                          {task.dueDate && (
                            <span className={`text-[10px] font-semibold ${overdue ? "text-highPriority" : "text-gray-500"}`}>
                              {overdue ? "Overdue · " : ""}
                              {moment(task.dueDate).format("MMM D")}
                            </span>
                          )}
                        </div>
                        <select
                          aria-label={`Move ${task.taskTitle} to another column`}
                          value={task.taskStatus in COLUMN_DOT ? task.taskStatus : "To Do"}
                          disabled={!movable}
                          onChange={(e) => move(task._id, e.target.value as TaskStatus)}
                          className="bg-C44 rounded-[4px] text-[10px] font-semibold text-C11 py-[2px] disabled:opacity-50"
                        >
                          {TASK_STATUSES.map((s) => (
                            <option key={s} value={s}>
                              {s}
                            </option>
                          ))}
                        </select>
                      </div>
                    </article>
                  );
                })}
              </div>
            </section>
          );
        })}
      </div>
    </div>
  );
}

export default KanbanBoard;

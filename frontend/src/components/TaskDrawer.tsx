import React, { useEffect, useMemo, useRef, useState } from "react";
import { Link } from "react-router-dom";
import { Close, ContentCopy, OpenInNew } from "@mui/icons-material";
import ModalOverlay from "../common/ModalOverlay";
import { TASK_STATUSES } from "../Constants";
import { useTask } from "../queries/hooks";
import { patchTask, TaskChanges } from "../services/taskServices";
import { errorMessage } from "../services/apiClient";
import DescriptionField from "./drawer/DescriptionField";
import LabelEditor from "./drawer/LabelEditor";
import SubtaskList from "./drawer/SubtaskList";
import TaskHistory from "./drawer/TaskHistory";
import TaskThread from "./drawer/TaskThread";
import { stopEscape, useDraft } from "./drawer/useDraft";

interface Props {
  taskId: string;
  /** The (populated) project the drawer is open on: its members fill the assignee list. */
  project: any;
  me: any;
  onClose: () => void;
}

const idOf = (v: any): string => String(v && v._id ? v._id : v ?? "");
const fullName = (u: any) => (u ? `${u.firstName ?? ""} ${u.lastName ?? ""}`.trim() : "Unassigned");

/** <input type="date"> wants YYYY-MM-DD; older tasks may hold other date strings. */
export const toDateInput = (s?: string): string => {
  if (!s) return "";
  if (/^\d{4}-\d{2}-\d{2}/.test(s)) return s.slice(0, 10);
  const t = Date.parse(s);
  return Number.isNaN(t) ? "" : new Date(t).toISOString().slice(0, 10);
};

const labelCls = "text-[10px] font-bold text-gray-500";
const controlCls = "bg-C44 rounded-[6px] px-2 py-1 text-[12px] w-full disabled:opacity-70 disabled:cursor-not-allowed";

function SelectField({ label, value, disabled, options, onCommit }: {
  label: string; value: string; disabled?: boolean; options: { value: string; label: string }[]; onCommit: (v: string) => Promise<boolean>;
}) {
  const [draft, setDraft] = useDraft(value);
  return (
    <label className="flex flex-col gap-1">
      <span className={labelCls}>{label}</span>
      <select
        className={controlCls}
        value={draft}
        disabled={disabled}
        onChange={async (e) => {
          setDraft(e.target.value);
          if (!(await onCommit(e.target.value))) setDraft(value); // refused: snap back
        }}
      >
        {options.map((o) => (
          <option key={o.value} value={o.value}>{o.label}</option>
        ))}
      </select>
    </label>
  );
}

function DateField({ value, disabled, onCommit }: { value: string; disabled?: boolean; onCommit: (v: string | null) => Promise<boolean> }) {
  const initial = toDateInput(value);
  const [draft, setDraft] = useDraft(initial);
  return (
    <label className="flex flex-col gap-1">
      <span className={labelCls}>Due date</span>
      <input
        type="date"
        className={controlCls}
        value={draft}
        disabled={disabled}
        onChange={async (e) => {
          setDraft(e.target.value);
          if (!(await onCommit(e.target.value || null))) setDraft(initial);
        }}
      />
    </label>
  );
}

function EstimateField({ value, disabled, onCommit, onInvalid }: {
  value: number | undefined | null; disabled?: boolean; onCommit: (v: number | null) => Promise<boolean>; onInvalid: (message: string) => void;
}) {
  const original = value == null ? "" : String(value);
  const [draft, setDraft] = useDraft(original);

  const commit = async () => {
    const text = draft.trim();
    if (text === original) return; // untouched: never send anything
    const n = text === "" ? null : Number(text);
    if (n !== null && (!Number.isFinite(n) || n < 0 || n > 1000)) {
      onInvalid("The estimate must be between 0 and 1000 hours.");
      return setDraft(original);
    }
    if (!(await onCommit(n))) setDraft(original);
  };

  return (
    <label className="flex flex-col gap-1">
      <span className={labelCls}>Estimate (hours)</span>
      <input
        type="number"
        min={0}
        max={1000}
        step={0.5}
        className={controlCls}
        value={draft}
        disabled={disabled}
        placeholder="None"
        onChange={(e) => setDraft(e.target.value)}
        onBlur={commit}
        onKeyDown={(e) => e.key === "Enter" && (e.target as HTMLInputElement).blur()}
      />
    </label>
  );
}

function EditableTitle({ value, canEdit, onSave }: { value: string; canEdit: boolean; onSave: (v: string) => Promise<boolean> }) {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(value);

  const commit = async () => {
    const next = draft.trim();
    setEditing(false);
    if (!next || next === value) return setDraft(value);
    if (!(await onSave(next))) setDraft(value);
  };

  if (editing) {
    return (
      <input
        autoFocus
        aria-label="Task title"
        value={draft}
        maxLength={200}
        onChange={(e) => setDraft(e.target.value)}
        onBlur={commit}
        onKeyDown={(e) => {
          stopEscape(e);
          if (e.key === "Enter") commit();
          if (e.key === "Escape") {
            setDraft(value);
            setEditing(false);
          }
        }}
        className="w-full bg-C44 rounded-[6px] px-2 py-1 text-[20px] font-extrabold"
      />
    );
  }
  return (
    <h2 className="text-[20px] font-extrabold break-words">
      {canEdit ? (
        <button
          onClick={() => {
            setDraft(value);
            setEditing(true);
          }}
          title="Click to rename"
          className="text-left w-full rounded-[6px] hover:bg-C44 px-1 -mx-1"
        >
          {value}
        </button>
      ) : (
        value
      )}
    </h2>
  );
}

function TaskDrawer({ taskId, project, me, onClose }: Props) {
  const taskQuery = useTask(taskId);
  const task: any = taskQuery.data;

  const [tab, setTab] = useState<"comments" | "history">("comments");
  const [notice, setNotice] = useState<string | null>(null);
  const [saving, setSaving] = useState(0);
  const [copied, setCopied] = useState(false);
  const copiedTimer = useRef<ReturnType<typeof setTimeout>>();
  useEffect(() => () => clearTimeout(copiedTimer.current), []);

  const uid = idOf(me);
  const isManager = idOf(project?.projectManager) === uid;
  const isCreator = !!task && idOf(task.assignedBy) === uid;
  const isAssignee = !!task && idOf(task.assignedTo) === uid;
  const canEdit = isManager || isCreator || isAssignee; // same rule as the server
  const canReassign = isManager || isCreator;

  const people = useMemo(() => {
    const seen = new Map<string, any>();
    [project?.projectManager, ...(project?.projectMembers || [])].forEach((m) => m && seen.set(idOf(m), m));
    return Array.from(seen.values());
  }, [project]);

  /** Sends only what changed. Resolves true when the server accepted it; the cache layer refreshes the task. */
  const save = async (changes: TaskChanges): Promise<boolean> => {
    setSaving((n) => n + 1);
    setNotice(null);
    const res: any = await patchTask(taskId, changes);
    setSaving((n) => n - 1);
    if (res?.editStatus) return true;
    setNotice(errorMessage(res, "Could not save the change."));
    return false;
  };

  const copyLink = async () => {
    try {
      await navigator.clipboard.writeText(`${window.location.origin}/project-page?id=${project._id}&task=${taskId}`);
      setCopied(true);
      clearTimeout(copiedTimer.current);
      copiedTimer.current = setTimeout(() => setCopied(false), 2000);
    } catch {
      setNotice("Could not copy the link.");
    }
  };

  const wrongProject = !!task && idOf(task.project) !== String(project?._id);

  return (
    <ModalOverlay onClose={onClose} placement="right" label={task ? `Task: ${task.taskTitle}` : "Task details"}>
      <aside className="bg-C55 w-full sm:w-[540px] h-full overflow-y-auto shadow-xl text-C11 flex flex-col">
        <header className="sticky top-0 z-10 bg-C55 flex flex-row items-center gap-2 px-4 py-3 border-b border-C44">
          <span className="text-[11px] font-semibold text-gray-500">{`#${taskId.slice(-6)}`}</span>
          <span aria-live="polite" className="text-[10px] text-gray-500">
            {saving > 0 ? "Saving..." : copied ? "Link copied" : ""}
          </span>
          <div className="ml-auto flex flex-row items-center gap-3">
            <button onClick={copyLink} aria-label="Copy link to this task" title="Copy link" className="hover:text-C22">
              <ContentCopy sx={{ fontSize: 16 }} />
            </button>
            <Link to={`/task-page?id=${taskId}`} aria-label="Open the full task page" title="Open full page" className="hover:text-C22">
              <OpenInNew sx={{ fontSize: 16 }} />
            </Link>
            <button onClick={onClose} aria-label="Close" className="hover:text-C22">
              <Close sx={{ fontSize: 20 }} />
            </button>
          </div>
        </header>

        <div className="flex flex-col gap-5 p-4">
          {notice && (
            <div role="alert" className="rounded-[4px] bg-inactiveRed text-highPriority text-[12px] font-semibold px-2 py-1">
              {notice}
            </div>
          )}

          {!task && taskQuery.isPending && <p className="py-10 text-center text-[12px] text-gray-500">Loading task...</p>}

          {!task && taskQuery.isError && (
            <div role="alert" className="flex flex-col items-center gap-2 py-10 text-[12px] text-highPriority font-semibold">
              <div>{errorMessage(taskQuery.error, "Could not load this task.")}</div>
              <button onClick={() => taskQuery.refetch()} className="bg-[#012b39f2] hover:bg-[#012B39] rounded-[8px] text-white font-bold text-[12px] py-1 px-4">
                Retry
              </button>
            </div>
          )}

          {task && wrongProject && (
            <div role="alert" className="py-8 text-center text-[13px]">
              This task belongs to a different project.{" "}
              <Link to={`/project-page?id=${idOf(task.project)}&task=${taskId}`} className="text-C22 underline">
                Open it there
              </Link>
            </div>
          )}

          {task && !wrongProject && (
            <>
              <EditableTitle value={task.taskTitle} canEdit={canEdit} onSave={(v) => save({ taskTitle: v })} />

              {!canEdit && <p className="text-[11px] text-gray-500 -mt-3">View only: only the project manager, the assignee or the creator can edit this task.</p>}

              <div className="grid grid-cols-2 gap-3">
                <SelectField
                  label="Status"
                  value={TASK_STATUSES.includes(task.taskStatus) ? task.taskStatus : "To Do"}
                  disabled={!canEdit}
                  options={TASK_STATUSES.map((s) => ({ value: s, label: s }))}
                  onCommit={(v) => save({ taskStatus: v })}
                />
                <SelectField
                  label="Priority"
                  value={task.taskPriority || "Medium"}
                  disabled={!canEdit}
                  options={["High", "Medium", "Low"].map((p) => ({ value: p, label: p }))}
                  onCommit={(v) => save({ taskPriority: v as TaskChanges["taskPriority"] })}
                />
                <SelectField
                  label="Assignee"
                  value={idOf(task.assignedTo)}
                  disabled={!canReassign}
                  options={people.map((p) => ({ value: idOf(p), label: fullName(p) }))}
                  onCommit={(v) => save({ assignedTo: v })}
                />
                <DateField value={task.dueDate} disabled={!canEdit} onCommit={(v) => save({ dueDate: v })} />
                <EstimateField value={task.estimateHours} disabled={!canEdit} onCommit={(v) => save({ estimateHours: v })} onInvalid={setNotice} />
                <div className="flex flex-col gap-1">
                  <span className={labelCls}>Created by</span>
                  <span className="text-[12px] py-1">{fullName(task.assignedBy)}</span>
                </div>
              </div>

              <section aria-labelledby="labels-h">
                <h3 id="labels-h" className={`${labelCls} mb-1`}>Labels</h3>
                <LabelEditor labels={task.labels || []} canEdit={canEdit} onChange={(labels) => save({ labels })} />
              </section>

              <section aria-labelledby="desc-h">
                <h3 id="desc-h" className="text-[12px] font-bold mb-1">Description</h3>
                <DescriptionField value={task.taskDescription || ""} canEdit={canEdit} onSave={(v) => save({ taskDescription: v })} />
              </section>

              <SubtaskList taskId={taskId} subtasks={task.subtasks || []} canEdit={canEdit} onError={setNotice} />

              <section>
                <div role="tablist" aria-label="Task discussion" className="flex flex-row gap-1 mb-3">
                  {(["comments", "history"] as const).map((key) => (
                    <button
                      key={key}
                      role="tab"
                      id={`drawer-tab-${key}`}
                      aria-selected={tab === key}
                      aria-controls={`drawer-panel-${key}`}
                      onClick={() => setTab(key)}
                      className={`rounded-[6px] font-bold text-[12px] py-1 px-3 ${tab === key ? "bg-[#012b3927] text-C11" : "text-gray-500"}`}
                    >
                      {key === "comments" ? `Comments${task.taskComments?.length ? ` (${task.taskComments.length})` : ""}` : "History"}
                    </button>
                  ))}
                </div>
                {tab === "comments" ? (
                  <div id="drawer-panel-comments" role="tabpanel" aria-labelledby="drawer-tab-comments">
                    <TaskThread taskId={taskId} comments={task.taskComments || []} />
                  </div>
                ) : (
                  <div id="drawer-panel-history" role="tabpanel" aria-labelledby="drawer-tab-history">
                    <TaskHistory projectId={String(project._id)} taskId={taskId} />
                  </div>
                )}
              </section>
            </>
          )}
        </div>
      </aside>
    </ModalOverlay>
  );
}

export default TaskDrawer;

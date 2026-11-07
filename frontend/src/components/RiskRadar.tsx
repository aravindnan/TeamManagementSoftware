import React, { useMemo, useState } from "react";
import TaskLink from "./TaskLink";
import moment from "moment";
import RiskChip, { RiskLevel } from "./RiskChip";

interface Props {
  risk: any | null; // response of GET /get-project-risk-by-id, or null while loading
  error: string | null;
  project: any;
  onRetry: () => void;
}

const TILE = (label: string, value: number, tone: string) => (
  <div key={label} className="flex flex-col rounded-[8px] bg-C44 px-3 py-2 min-w-[110px]">
    <div className={`text-[24px] font-extrabold leading-none ${tone}`}>{value}</div>
    <div className="text-[10px] font-bold text-C11 mt-1">{label}</div>
  </div>
);

function RiskRadar({ risk, error, project, onRetry }: Props) {
  const [showAll, setShowAll] = useState(false);

  const names = useMemo(() => {
    const map = new Map<string, string>();
    [project?.projectManager, ...(project?.projectMembers || [])].forEach(
      (m) => m && map.set(String(m._id), `${m.firstName} ${m.lastName}`.trim())
    );
    return map;
  }, [project]);

  if (error) {
    return (
      <div role="alert" className="flex flex-col items-center gap-2 py-10 text-[12px] text-highPriority font-semibold">
        <div>{error}</div>
        <button onClick={onRetry} className="bg-[#012b39f2] hover:bg-[#012B39] rounded-[8px] text-white font-bold text-[12px] py-1 px-4">
          Retry
        </button>
      </div>
    );
  }
  if (!risk) return <div className="py-10 text-center text-[12px] text-gray-500">Analysing deadlines...</div>;

  const { summary, tasks } = risk;
  const atRisk = tasks.filter((t: any) => t.level === "high" || t.level === "medium");
  const shown = showAll ? tasks : atRisk;

  return (
    <div className="flex flex-col flex-1 min-h-0 gap-3">
      <div className="flex flex-row flex-wrap gap-2">
        {TILE("High risk", summary.high, "text-highPriority")}
        {TILE("At risk", summary.medium, "text-C11")}
        {TILE("On track", summary.onTrack, "text-C22")}
        {TILE("No due date", summary.unscheduled, "text-gray-500")}
      </div>

      <div className="flex flex-row flex-wrap items-center justify-between gap-2">
        <label className="flex flex-row items-center gap-1 text-[12px] font-semibold text-C11 cursor-pointer select-none">
          <input type="checkbox" checked={showAll} onChange={(e) => setShowAll(e.target.checked)} />
          Show on-track and unscheduled tasks too
        </label>
        <details className="text-[11px] text-C11 max-w-full">
          <summary className="cursor-pointer font-bold">How is risk calculated?</summary>
          <ul className="list-disc pl-5 mt-1 space-y-[2px] text-gray-600">
            <li>Time left versus the work that remains, using how long this project's finished tasks usually take (or a default per priority until there are 3 to learn from).</li>
            <li>Overdue tasks, and unstarted tasks due within 2 days.</li>
            <li>No activity for 4+ days on work that should be moving.</li>
            <li>Assignees with 4+ open tasks and a deadline inside a week.</li>
            <li>Score 60+ is high risk, 35+ is at risk. Every factor that applies is listed on the task.</li>
          </ul>
        </details>
      </div>

      <div className="flex flex-col gap-2 overflow-y-auto flex-1 min-h-0 pr-1">
        {shown.length === 0 && (
          <div className="py-10 text-center text-[12px] text-gray-500">
            {summary.openTasks === 0 ? "There are no open tasks." : "Nothing is at risk right now. Every dated task has enough time."}
          </div>
        )}
        {shown.map((t: any) => (
          <article key={t.taskId} className="bg-white rounded-[6px] p-3 shadow-sm">
            <div className="flex flex-row flex-wrap items-center gap-2">
              <RiskChip level={t.level as RiskLevel} />
              <TaskLink
                taskId={t.taskId}
                className="text-[13px] font-semibold text-C11 hover:underline underline-offset-2 break-words"
              >
                {t.taskTitle}
              </TaskLink>
              <span className="ml-auto text-[10px] font-semibold text-gray-500">{`${t.taskStatus} · ${names.get(t.assignedTo) || "Unassigned"}${
                t.dueDate ? ` · due ${moment(t.dueDate).format("MMM D")}` : ""
              }`}</span>
            </div>
            <ul className="list-disc pl-5 mt-2 space-y-[2px] text-[11px] text-C11">
              {t.reasons.map((r: string, i: number) => (
                <li key={i}>{r}</li>
              ))}
            </ul>
            {t.metrics && (
              <div className="mt-2 text-[10px] text-gray-500">
                {`Risk score ${t.score}/100 · typical cycle ${t.metrics.typicalCycleDays}d (${
                  t.metrics.estimateSource === "default" ? "default estimate" : `${t.metrics.sampleSize} finished tasks`
                })`}
              </div>
            )}
          </article>
        ))}
      </div>
    </div>
  );
}

export default RiskRadar;

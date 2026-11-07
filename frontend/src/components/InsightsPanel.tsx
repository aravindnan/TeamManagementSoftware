import React, { useMemo } from "react";
import TaskLink from "./TaskLink";
import moment from "moment";
import { barGeometry, linePoints, niceMax } from "../helper/charts";

interface Props {
  data: any | null; // response of GET /get-project-analytics-by-id, or null while loading
  error: string | null;
  project: any;
  onRetry: () => void;
}

const W = 520;
const H = 150;
const PAD = { top: 12, right: 8, bottom: 22, left: 28 };
const PLOT_W = W - PAD.left - PAD.right;
const PLOT_H = H - PAD.top - PAD.bottom;

const Tile = ({ label, value, sub }: { label: string; value: string; sub?: string }) => (
  <div className="flex flex-col rounded-[8px] bg-C44 px-3 py-2 min-w-[120px] flex-1">
    <div className="text-[22px] font-extrabold leading-none text-C11">{value}</div>
    <div className="text-[10px] font-bold text-C11 mt-1">{label}</div>
    {sub && <div className="text-[10px] text-gray-500 mt-[2px]">{sub}</div>}
  </div>
);

const Axis = ({ ceiling }: { ceiling: number }) => (
  <>
    {[0, ceiling / 2, ceiling].map((tick) => {
      const y = PAD.top + PLOT_H - (tick / ceiling) * PLOT_H;
      return (
        <g key={tick} className="text-gray-300">
          <line x1={PAD.left} x2={W - PAD.right} y1={y} y2={y} stroke="currentColor" strokeWidth={tick === 0 ? 1 : 0.5} />
          <text x={PAD.left - 4} y={y + 3} textAnchor="end" fontSize={8} className="fill-current text-gray-500">
            {Number.isInteger(tick) ? tick : tick.toFixed(1)}
          </text>
        </g>
      );
    })}
  </>
);

function InsightsPanel({ data, error, project, onRetry }: Props) {
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
  if (!data) return <div className="py-10 text-center text-[12px] text-gray-500">Crunching the numbers...</div>;

  const { summary, cycleTime, throughput, burnup, aging, byAssignee, scope } = data;
  const thisWeek = throughput[throughput.length - 1]?.completed ?? 0;

  // throughput chart
  const tpCeiling = niceMax(Math.max(...throughput.map((w: any) => w.completed), 0));
  const bars = barGeometry(throughput.map((w: any) => w.completed), PLOT_W, PLOT_H, tpCeiling);

  // burn-up chart
  const buCeiling = niceMax(Math.max(...burnup.map((d: any) => d.created), 0));
  const createdLine = linePoints(burnup.map((d: any) => d.created), PLOT_W, PLOT_H, buCeiling);
  const completedLine = linePoints(burnup.map((d: any) => d.completed), PLOT_W, PLOT_H, buCeiling);
  const first = burnup[0]?.date;
  const last = burnup[burnup.length - 1]?.date;

  return (
    <div className="flex flex-col flex-1 min-h-0 overflow-y-auto gap-4 pr-1">
      <p className="text-[11px] text-gray-500">
        A completion percentage alone can mislead. These figures show how work actually flows through this project.
      </p>

      <div className="flex flex-row flex-wrap gap-2">
        <Tile
          label="Median cycle time"
          value={cycleTime.median === null ? "n/a" : `${cycleTime.median}d`}
          sub={cycleTime.sampleSize ? `85% finish within ${cycleTime.p85}d · ${cycleTime.sampleSize} tasks` : "No finished tasks yet"}
        />
        <Tile label="Done this week" value={String(thisWeek)} sub={`${summary.completed} of ${summary.total} overall (${summary.completionRate}%)`} />
        <Tile label="Open tasks" value={String(summary.open)} />
        <Tile label="Overdue" value={String(summary.overdue)} sub={summary.overdue ? "past their due date" : "nothing late"} />
      </div>

      <section aria-labelledby="tp-h">
        <h3 id="tp-h" className="text-[12px] font-bold text-C11 mb-1">Tasks completed per week</h3>
        <svg viewBox={`0 0 ${W} ${H}`} role="img" aria-label={`Bar chart of tasks completed per week over the last ${throughput.length} weeks. ${thisWeek} this week.`} className="w-full max-w-[560px]">
          <Axis ceiling={tpCeiling} />
          <g transform={`translate(${PAD.left},${PAD.top})`}>
            {bars.map((b, i) => (
              <g key={throughput[i].weekStart}>
                <rect x={b.x} y={b.y} width={b.width} height={b.height} rx={2} className="fill-current text-C11" />
                {b.value > 0 && (
                  <text x={b.x + b.width / 2} y={b.y - 3} textAnchor="middle" fontSize={8} className="fill-current text-C11">
                    {b.value}
                  </text>
                )}
                <text x={b.x + b.width / 2} y={PLOT_H + 12} textAnchor="middle" fontSize={8} className="fill-current text-gray-500">
                  {moment(throughput[i].weekStart).format("MMM D")}
                </text>
              </g>
            ))}
          </g>
        </svg>
        <table className="sr-only">
          <caption>Tasks completed per week</caption>
          <tbody>
            {throughput.map((w: any) => (
              <tr key={w.weekStart}>
                <th scope="row">{`Week of ${w.weekStart}`}</th>
                <td>{w.completed}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </section>

      <section aria-labelledby="bu-h">
        <div className="flex flex-row items-center justify-between mb-1 max-w-[560px]">
          <h3 id="bu-h" className="text-[12px] font-bold text-C11">Burn-up: created vs completed (last {burnup.length} days)</h3>
          <div className="flex flex-row gap-3 text-[10px] text-gray-600" aria-hidden>
            <span className="flex items-center gap-1"><span className="inline-block w-3 h-[2px] bg-C22" />Created</span>
            <span className="flex items-center gap-1"><span className="inline-block w-3 h-[2px] bg-C11" />Completed</span>
          </div>
        </div>
        <svg viewBox={`0 0 ${W} ${H}`} role="img" aria-label={`Burn-up chart. ${burnup[burnup.length - 1]?.created ?? 0} tasks created and ${burnup[burnup.length - 1]?.completed ?? 0} completed in total.`} className="w-full max-w-[560px]">
          <Axis ceiling={buCeiling} />
          <g transform={`translate(${PAD.left},${PAD.top})`}>
            <polyline points={createdLine} fill="none" strokeWidth={2} className="stroke-current text-C22" />
            <polyline points={completedLine} fill="none" strokeWidth={2} className="stroke-current text-C11" />
            <text x={0} y={PLOT_H + 12} fontSize={8} className="fill-current text-gray-500">{first && moment(first).format("MMM D")}</text>
            <text x={PLOT_W} y={PLOT_H + 12} textAnchor="end" fontSize={8} className="fill-current text-gray-500">{last && moment(last).format("MMM D")}</text>
          </g>
        </svg>
        <div className="text-[10px] text-gray-500 max-w-[560px]">When the lines move apart, work is being added faster than it is finished.</div>
      </section>

      <section aria-labelledby="ag-h">
        <h3 id="ag-h" className="text-[12px] font-bold text-C11 mb-1">Longest in progress</h3>
        {aging.length === 0 ? (
          <div className="text-[11px] text-gray-500">Nothing is currently in progress or in review.</div>
        ) : (
          <ul className="flex flex-col gap-1 max-w-[560px]">
            {aging.map((t: any) => {
              const slow = cycleTime.p85 !== null && t.daysInColumn > cycleTime.p85;
              return (
                <li key={t.taskId} className="flex flex-row flex-wrap items-center gap-2 bg-white rounded-[6px] px-2 py-1 shadow-sm text-[12px]">
                  <TaskLink taskId={t.taskId} className="font-semibold text-C11 hover:underline underline-offset-2">{t.taskTitle}</TaskLink>
                  <span className="text-[10px] text-gray-500">{`${t.taskStatus} · ${names.get(t.assignedTo) || "Unassigned"}`}</span>
                  <span className="ml-auto text-[10px] font-semibold text-C11">{`${t.daysInColumn}d in column · ${t.ageDays}d old`}</span>
                  {slow && <span className="text-[9px] font-bold rounded-[4px] bg-mediumPriority text-C11 px-[6px] py-[1px]">Slower than 85% of finished tasks</span>}
                </li>
              );
            })}
          </ul>
        )}
      </section>

      <section aria-labelledby="pp-h" className="pb-2">
        <h3 id="pp-h" className="text-[12px] font-bold text-C11 mb-1">{scope === "all" ? "By person" : "Your figures"}</h3>
        <table className="text-[12px] max-w-[560px] w-full">
          <thead>
            <tr className="text-left text-[10px] text-gray-500">
              <th className="font-bold py-1">Person</th><th className="font-bold">Open</th><th className="font-bold">Done</th><th className="font-bold">Overdue</th>
            </tr>
          </thead>
          <tbody>
            {byAssignee.map((p: any) => (
              <tr key={p.assignedTo} className="border-t border-C44">
                <td className="py-1 font-semibold text-C11">{names.get(p.assignedTo) || "Unknown"}</td>
                <td>{p.open}</td><td>{p.completed}</td>
                <td className={p.overdue ? "text-highPriority font-bold" : ""}>{p.overdue}</td>
              </tr>
            ))}
            {byAssignee.length === 0 && <tr><td colSpan={4} className="py-2 text-gray-500">No tasks assigned to you yet.</td></tr>}
          </tbody>
        </table>
        {scope !== "all" && <div className="text-[10px] text-gray-500 mt-1">Per-person figures for the whole team are visible to the project manager only.</div>}
      </section>
    </div>
  );
}

export default InsightsPanel;

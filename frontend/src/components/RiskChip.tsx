import React from "react";

export type RiskLevel = "high" | "medium" | "on-track" | "unscheduled";

const STYLE: Record<RiskLevel, { label: string; cls: string }> = {
  high: { label: "High risk", cls: "bg-inactiveRed text-highPriority" },
  medium: { label: "At risk", cls: "bg-mediumPriority text-C11" },
  "on-track": { label: "On track", cls: "bg-C44 text-C22" },
  unscheduled: { label: "No due date", cls: "bg-C44 text-gray-500" },
};

export const riskLabel = (level: RiskLevel) => STYLE[level].label;

/** Small pill for a task's deadline risk. The reasons are exposed as a tooltip and to screen readers. */
function RiskChip({ level, reasons = [] }: { level: RiskLevel; reasons?: string[] }) {
  const { label, cls } = STYLE[level];
  return (
    <span title={reasons.join(" ")} className={`inline-block rounded-[4px] px-[6px] py-[1px] text-[9px] font-bold ${cls}`}>
      {label}
      {reasons.length > 0 && <span className="sr-only">{`: ${reasons.join(" ")}`}</span>}
    </span>
  );
}

export default RiskChip;

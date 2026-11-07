import { Close } from "@mui/icons-material";
import React, { useState } from "react";
import ModalOverlay from "../common/ModalOverlay";
import KanbanBoard from "../components/KanbanBoard";
import RiskRadar from "../components/RiskRadar";
import InsightsPanel from "../components/InsightsPanel";
import { useProjectAnalytics, useProjectRisk } from "../queries/hooks";
import { errorMessage } from "../services/apiClient";

type View = "board" | "radar" | "insights";

function BoardModal(props: any) {
  const { activeProject, myProfiledata, setBoardModal } = props;
  const [view, setView] = useState<View>("board");

  // Both views are cached queries under the project's key, so any change to the project (a card move,
  // a new task...) marks them stale and the visible one refreshes by itself. Insights loads on first open.
  const riskQuery = useProjectRisk(activeProject._id);
  const insightsQuery = useProjectAnalytics(activeProject._id, view === "insights");

  const risk = riskQuery.data ?? null;
  const riskError = riskQuery.isError && !risk ? errorMessage(riskQuery.error, "Could not analyse deadlines.") : null;
  const insightsError = insightsQuery.isError && !insightsQuery.data ? errorMessage(insightsQuery.error, "Could not load insights.") : null;

  const riskByTask = Object.fromEntries((risk?.tasks || []).map((t: any) => [t.taskId, t]));
  const atRiskCount = risk ? risk.summary.high + risk.summary.medium : 0;

  const tab = (key: View, label: string, badge?: number) => (
    <button
      role="tab"
      id={`tab-${key}`}
      aria-selected={view === key}
      aria-controls={`panel-${key}`}
      onClick={() => setView(key)}
      className={`rounded-[6px] font-bold text-[12px] py-1 px-3 ${view === key ? "bg-[#012b3927] text-C11" : "text-gray-500"}`}
    >
      {label}
      {!!badge && <span className="ml-1 rounded-full bg-inactiveRed text-highPriority text-[10px] px-[6px]">{badge}</span>}
    </button>
  );

  return (
    <ModalOverlay onClose={() => setBoardModal(false)}>
      <div className="bg-C55 rounded-[8px] p-5 w-[95%] max-w-[1200px] h-[85vh] flex flex-col shadow-xl text-C11">
        <div className="flex flex-row items-center justify-between pb-2">
          <div className="font-bold text-[20px] text-C11">{`${activeProject?.projectName || "Project"} · Board`}</div>
          <button className="cursor-pointer" onClick={() => setBoardModal(false)} aria-label="Close">
            <Close sx={{ fontSize: 20, fontWeight: 800 }} />
          </button>
        </div>

        <div role="tablist" aria-label="Project views" className="flex flex-row gap-1 pb-2">
          {tab("board", "Board")}
          {tab("radar", "Risk radar", atRiskCount)}
          {tab("insights", "Insights")}
        </div>

        {/* All panels stay mounted so scroll position and the open tab survive switching. */}
        <div id="panel-board" role="tabpanel" aria-labelledby="tab-board" className={view === "board" ? "flex flex-col flex-1 min-h-0" : "hidden"}>
          <KanbanBoard project={activeProject} me={myProfiledata} riskByTask={riskByTask} />
        </div>
        <div id="panel-radar" role="tabpanel" aria-labelledby="tab-radar" className={view === "radar" ? "flex flex-col flex-1 min-h-0" : "hidden"}>
          <RiskRadar risk={risk} error={riskError} project={activeProject} onRetry={() => riskQuery.refetch()} />
        </div>
        <div id="panel-insights" role="tabpanel" aria-labelledby="tab-insights" className={view === "insights" ? "flex flex-col flex-1 min-h-0" : "hidden"}>
          <InsightsPanel data={insightsQuery.data ?? null} error={insightsError} project={activeProject} onRetry={() => insightsQuery.refetch()} />
        </div>
      </div>
    </ModalOverlay>
  );
}

export default BoardModal;

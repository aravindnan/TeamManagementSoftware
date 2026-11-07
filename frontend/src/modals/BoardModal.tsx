import { Close } from "@mui/icons-material";
import React, { useCallback, useEffect, useRef, useState } from "react";
import ModalOverlay from "../common/ModalOverlay";
import KanbanBoard from "../components/KanbanBoard";
import RiskRadar from "../components/RiskRadar";
import { getProjectRisk } from "../services/projectServices";
import { errorMessage, isApiError } from "../services/apiClient";

type View = "board" | "radar";

function BoardModal(props: any) {
  const { activeProject, myProfiledata, setBoardModal, triggerRerender } = props;
  const changed = useRef(false);
  const [view, setView] = useState<View>("board");
  const [risk, setRisk] = useState<any | null>(null);
  const [riskError, setRiskError] = useState<string | null>(null);

  const loadRisk = useCallback(async () => {
    const res: any = await getProjectRisk(activeProject?._id);
    if (isApiError(res) || !res?.summary) {
      setRiskError(errorMessage(res, "Could not analyse deadlines."));
    } else {
      setRisk(res);
      setRiskError(null);
    }
  }, [activeProject?._id]);

  useEffect(() => {
    loadRisk();
  }, [loadRisk]);

  // The page's own task lists are refreshed once, when the modal closes (moves are already optimistic here).
  const close = () => {
    setBoardModal(false);
    if (changed.current) triggerRerender();
  };

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
    <ModalOverlay onClose={close}>
      <div className="bg-C55 rounded-[8px] p-5 w-[95%] max-w-[1200px] h-[85vh] flex flex-col shadow-xl text-C11">
        <div className="flex flex-row items-center justify-between pb-2">
          <div className="font-bold text-[20px] text-C11">{`${activeProject?.projectName || "Project"} · Board`}</div>
          <button className="cursor-pointer" onClick={close} aria-label="Close">
            <Close sx={{ fontSize: 20, fontWeight: 800 }} />
          </button>
        </div>

        <div role="tablist" aria-label="Project views" className="flex flex-row gap-1 pb-2">
          {tab("board", "Board")}
          {tab("radar", "Risk radar", atRiskCount)}
        </div>

        {/* Both panels stay mounted so optimistic board state survives switching tabs. */}
        <div id="panel-board" role="tabpanel" aria-labelledby="tab-board" className={view === "board" ? "flex flex-col flex-1 min-h-0" : "hidden"}>
          <KanbanBoard
            project={activeProject}
            me={myProfiledata}
            riskByTask={riskByTask}
            onChanged={() => {
              changed.current = true;
              loadRisk(); // a move changes the risk picture
            }}
          />
        </div>
        <div id="panel-radar" role="tabpanel" aria-labelledby="tab-radar" className={view === "radar" ? "flex flex-col flex-1 min-h-0" : "hidden"}>
          <RiskRadar risk={risk} error={riskError} project={activeProject} onRetry={loadRisk} />
        </div>
      </div>
    </ModalOverlay>
  );
}

export default BoardModal;

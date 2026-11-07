import { Close } from "@mui/icons-material";
import React, { useRef } from "react";
import ModalOverlay from "../common/ModalOverlay";
import KanbanBoard from "../components/KanbanBoard";

function BoardModal(props: any) {
  const { activeProject, myProfiledata, setBoardModal, triggerRerender } = props;
  const changed = useRef(false);

  // The page's own task lists are refreshed once, when the board closes (moves are already optimistic here).
  const close = () => {
    setBoardModal(false);
    if (changed.current) triggerRerender();
  };

  return (
    <ModalOverlay onClose={close}>
      <div className="bg-C55 rounded-[8px] p-5 w-[95%] max-w-[1200px] h-[85vh] flex flex-col shadow-xl text-C11">
        <div className="flex flex-row items-center justify-between pb-2">
          <div className="font-bold text-[20px] text-C11">{`${activeProject?.projectName || "Project"} · Board`}</div>
          <button className="cursor-pointer" onClick={close} aria-label="Close">
            <Close sx={{ fontSize: 20, fontWeight: 800 }} />
          </button>
        </div>
        <KanbanBoard
          project={activeProject}
          me={myProfiledata}
          onChanged={() => {
            changed.current = true;
          }}
        />
      </div>
    </ModalOverlay>
  );
}

export default BoardModal;

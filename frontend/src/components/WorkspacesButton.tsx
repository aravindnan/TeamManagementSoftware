import { Groups } from "@mui/icons-material";
import React, { useState } from "react";
import { useSelector } from "react-redux";
import { colors } from "../Constants";
import { useMyInvites } from "../queries/hooks";
import WorkspacesModal from "../modals/WorkspacesModal";

/** Opens the workspaces panel. A dot shows when you have invitations waiting. */
function WorkspacesButton() {
  const signedIn = useSelector((state: any) => state.authReducer.isAuthenticated);
  const { data: invites = [] } = useMyInvites(signedIn);
  const [open, setOpen] = useState(false);

  return (
    <>
      <button
        onClick={() => setOpen(true)}
        aria-label={invites.length ? `Workspaces, ${invites.length} invitation${invites.length === 1 ? "" : "s"} waiting` : "Workspaces"}
        title="Workspaces"
        className="relative flex justify-center py-2 cursor-pointer"
      >
        <Groups sx={{ fontSize: 22, color: colors.C11 }} />
        {invites.length > 0 && <span aria-hidden className="absolute top-[4px] right-[-4px] w-[9px] h-[9px] rounded-full bg-highPriority" />}
      </button>
      {open && <WorkspacesModal setOpen={setOpen} />}
    </>
  );
}

export default WorkspacesButton;

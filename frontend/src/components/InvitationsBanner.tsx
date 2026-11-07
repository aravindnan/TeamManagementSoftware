import React, { useState } from "react";
import { useMyInvites } from "../queries/hooks";
import { errorMessage } from "../services/apiClient";
import { acceptInviteById, declineInviteById } from "../services/workspaceServices";

/** Invitations waiting for the signed-in person (only shown for an email we have verified). */
function InvitationsBanner() {
  const { data: invites = [] } = useMyInvites();
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState<string | null>(null);

  if (invites.length === 0) return null;

  const act = async (id: string, kind: "accept" | "decline") => {
    setBusy(id);
    setError(null);
    const res: any = await (kind === "accept" ? acceptInviteById(id) : declineInviteById(id));
    setBusy(null);
    const ok = kind === "accept" ? !!res?.workspace : !!res?.declined;
    if (!ok) setError(errorMessage(res, kind === "accept" ? "Could not accept the invitation." : "Could not decline the invitation."));
  };

  return (
    <section aria-label="Workspace invitations" className="mt-6 rounded-[8px] bg-C44 p-3 flex flex-col gap-2 max-w-[620px]">
      <div className="text-[13px] font-bold">{invites.length === 1 ? "You have an invitation" : `You have ${invites.length} invitations`}</div>
      {invites.map((inv: any) => (
        <div key={inv._id} className="flex flex-row flex-wrap items-center gap-2">
          <div className="flex-1 min-w-[200px] text-[13px]">
            <span className="font-bold">{inv.inviterName}</span> invited you to join <span className="font-bold">{inv.workspaceName}</span> as {inv.role === "admin" ? "an admin" : "a member"}
          </div>
          <button
            disabled={busy === inv._id}
            onClick={() => act(inv._id, "accept")}
            aria-label={`Accept the invitation to ${inv.workspaceName}`}
            className="bg-[#012b39f2] hover:bg-[#012B39] disabled:opacity-60 rounded-[8px] text-white font-bold text-[12px] py-1 px-4"
          >
            Accept
          </button>
          <button
            disabled={busy === inv._id}
            onClick={() => act(inv._id, "decline")}
            aria-label={`Decline the invitation to ${inv.workspaceName}`}
            className="rounded-[8px] hover:bg-[#012b3927] text-C11 font-bold text-[12px] py-1 px-3"
          >
            Decline
          </button>
        </div>
      ))}
      {error && <div role="alert" className="text-[12px] text-highPriority font-semibold">{error}</div>}
    </section>
  );
}

export default InvitationsBanner;

import React, { useState } from "react";
import ConfirmButton from "../../common/ConfirmButton";
import { expiresIn, invitableRoles } from "../../helper/workspaceRoles";
import { useWorkspaceInvites } from "../../queries/hooks";
import { errorMessage } from "../../services/apiClient";
import { createInvite, regenerateInvite, revokeInvite, WorkspaceRole } from "../../services/workspaceServices";
import CopyField from "./CopyField";

interface Props {
  workspaceId: string;
  myRole: WorkspaceRole;
  onError: (message: string | null) => void;
}

const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

function InvitesSection({ workspaceId, myRole, onError }: Props) {
  const invites = useWorkspaceInvites(workspaceId, true);
  const roles = invitableRoles(myRole);
  const [email, setEmail] = useState("");
  const [role, setRole] = useState<"admin" | "member">("member");
  const [busy, setBusy] = useState(false);
  // The link is only shown right after it is created or regenerated: the server keeps just a hash.
  const [fresh, setFresh] = useState<{ email: string; link: string } | null>(null);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    const address = email.trim();
    if (!EMAIL.test(address)) return onError("Enter a valid email address.");
    setBusy(true);
    const res: any = await createInvite(workspaceId, address, role);
    setBusy(false);
    if (!res?.link) return onError(errorMessage(res, "Could not create the invitation."));
    onError(null);
    setFresh({ email: res.invite.email, link: res.link });
    setEmail("");
  };

  const newLink = async (id: string, to: string) => {
    const res: any = await regenerateInvite(workspaceId, id);
    if (!res?.link) return onError(errorMessage(res, "Could not create a new link."));
    onError(null);
    setFresh({ email: to, link: res.link });
  };

  const revoke = async (id: string) => {
    const res: any = await revokeInvite(workspaceId, id);
    if (!res?.revoked) return onError(errorMessage(res, "Could not revoke the invitation."));
    onError(null);
    setFresh(null);
  };

  return (
    <section aria-labelledby="invites-h">
      <h3 id="invites-h" className="text-[13px] font-bold mb-2">Invite people</h3>
      <form onSubmit={submit} className="flex flex-row flex-wrap gap-2 items-center">
        <input
          type="email"
          aria-label="Email address to invite"
          placeholder="name@company.com"
          value={email}
          maxLength={254}
          onChange={(e) => setEmail(e.target.value)}
          className="flex-1 min-w-[180px] bg-C44 rounded-[6px] px-2 py-2 text-[13px]"
        />
        {roles.length > 1 && (
          <select aria-label="Role for the invitation" value={role} onChange={(e) => setRole(e.target.value as "admin" | "member")} className="bg-C44 rounded-[6px] text-[12px] font-semibold px-2 py-2">
            <option value="member">Member</option>
            <option value="admin">Admin</option>
          </select>
        )}
        <button type="submit" disabled={busy || !email.trim()} className="bg-[#012b39f2] hover:bg-[#012B39] disabled:opacity-50 rounded-[8px] text-white font-bold text-[12px] py-2 px-4">
          {busy ? "Creating..." : "Create invitation"}
        </button>
      </form>

      {fresh && (
        <div className="mt-3 rounded-[8px] bg-C44 p-3 flex flex-col gap-2" role="status">
          <div className="text-[12px]">
            Share this link with <span className="font-bold">{fresh.email}</span>. It works once, expires in 7 days, and can only be accepted from that address.
          </div>
          <CopyField value={fresh.link} label="Invitation link" />
          <div className="text-[11px] text-gray-500">We don't send email yet, so copy the link and send it yourself. If they already have a verified account here they will also see it in the app.</div>
        </div>
      )}

      <h4 className="text-[12px] font-bold mt-4 mb-1">Pending invitations</h4>
      {invites.isPending && <p className="text-[12px] text-gray-500">Loading...</p>}
      {invites.isError && !invites.data && <p role="alert" className="text-[12px] text-highPriority font-semibold">{errorMessage(invites.error, "Could not load invitations.")}</p>}
      {invites.data && invites.data.length === 0 && <p className="text-[12px] text-gray-500">No pending invitations.</p>}
      <ul className="flex flex-col divide-y divide-C44">
        {(invites.data || []).map((inv: any) => (
          <li key={inv._id} className="flex flex-row flex-wrap items-center gap-2 py-2">
            <div className="min-w-0 flex-1">
              <div className="text-[13px] font-semibold truncate">{inv.email}</div>
              <div className="text-[11px] text-gray-500">{`${inv.role === "admin" ? "Admin" : "Member"} · expires ${expiresIn(inv.expiresAt)}`}</div>
            </div>
            <button
              onClick={() => newLink(inv._id, inv.email)}
              aria-label={`Get a new link for ${inv.email}`}
              className="text-[11px] font-bold rounded-[6px] px-2 py-1 text-C22 hover:bg-[#012b3927]"
            >
              New link
            </button>
            <ConfirmButton
              label="Revoke"
              aria-label={`Revoke the invitation for ${inv.email}`}
              confirmLabel="Revoke?"
              onConfirm={() => revoke(inv._id)}
              className="text-[11px] font-bold rounded-[6px] px-2 py-1 text-highPriority hover:bg-inactiveRed"
            />
          </li>
        ))}
      </ul>
    </section>
  );
}

export default InvitesSection;

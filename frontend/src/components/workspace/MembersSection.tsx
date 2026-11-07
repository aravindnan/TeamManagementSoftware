import React from "react";
import ConfirmButton from "../../common/ConfirmButton";
import { canChangeRole, canRemove, roleLabel } from "../../helper/workspaceRoles";
import { errorMessage } from "../../services/apiClient";
import { removeWorkspaceMember, setMemberRole, WorkspaceRole } from "../../services/workspaceServices";

interface Member {
  user: { _id: string; firstName: string; lastName: string; email?: string };
  role: WorkspaceRole;
}

interface Props {
  workspaceId: string;
  members: Member[];
  myRole: WorkspaceRole;
  myId: string;
  onError: (message: string | null) => void;
  /** Called after someone leaves, so the modal can move on from a workspace they no longer belong to. */
  onLeft: () => void;
}

const initials = (u: Member["user"]) => `${u.firstName?.[0] ?? ""}${u.lastName?.[0] ?? ""}`.toUpperCase();

function MembersSection({ workspaceId, members, myRole, myId, onError, onLeft }: Props) {
  const changeRole = async (userId: string, role: "admin" | "member") => {
    const res: any = await setMemberRole(workspaceId, userId, role);
    onError(res?.role ? null : errorMessage(res, "Could not change the role."));
  };

  const remove = async (member: Member, isSelf: boolean) => {
    const res: any = await removeWorkspaceMember(workspaceId, member.user._id);
    if (!res?.removed) return onError(errorMessage(res, isSelf ? "Could not leave the workspace." : "Could not remove that person."));
    onError(null);
    if (isSelf) onLeft();
  };

  return (
    <section aria-labelledby="members-h">
      <h3 id="members-h" className="text-[13px] font-bold mb-2">{`Members (${members.length})`}</h3>
      <ul className="flex flex-col divide-y divide-C44">
        {members.map((m) => {
          const self = m.user._id === myId;
          const name = `${m.user.firstName} ${m.user.lastName}`.trim();
          return (
            <li key={m.user._id} className="flex flex-row items-center gap-3 py-2">
              <span className="flex items-center justify-center w-[30px] h-[30px] rounded-full bg-C11 text-white text-[10px] font-semibold shrink-0">{initials(m.user)}</span>
              <div className="min-w-0 flex-1">
                <div className="text-[13px] font-semibold truncate">{name}{self && <span className="text-gray-500 font-normal"> (you)</span>}</div>
                {m.user.email && <div className="text-[11px] text-gray-500 truncate">{m.user.email}</div>}
              </div>
              {canChangeRole(myRole, m.role) ? (
                <select
                  aria-label={`Role of ${name}`}
                  value={m.role}
                  onChange={(e) => changeRole(m.user._id, e.target.value as "admin" | "member")}
                  className="bg-C44 rounded-[6px] text-[12px] font-semibold px-2 py-1"
                >
                  <option value="member">Member</option>
                  <option value="admin">Admin</option>
                </select>
              ) : (
                <span className="text-[11px] font-bold rounded-[4px] bg-C44 px-2 py-[2px]">{roleLabel(m.role)}</span>
              )}
              {canRemove(myRole, m.role, self) ? (
                <ConfirmButton
                  label={self ? "Leave" : "Remove"}
                  aria-label={self ? "Leave this workspace" : `Remove ${name}`}
                  confirmLabel={self ? "Leave?" : "Remove?"}
                  onConfirm={() => remove(m, self)}
                  className="text-[11px] font-bold rounded-[6px] px-2 py-1 text-highPriority hover:bg-inactiveRed"
                />
              ) : (
                <span className="w-[56px]" aria-hidden />
              )}
            </li>
          );
        })}
      </ul>
    </section>
  );
}

export default MembersSection;

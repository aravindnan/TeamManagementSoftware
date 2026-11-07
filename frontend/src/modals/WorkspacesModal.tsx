import { Close } from "@mui/icons-material";
import React, { useEffect, useState } from "react";
import { useSelector } from "react-redux";
import ConfirmButton from "../common/ConfirmButton";
import ModalOverlay from "../common/ModalOverlay";
import InvitesSection from "../components/workspace/InvitesSection";
import MembersSection from "../components/workspace/MembersSection";
import { canManage, isOwner, roleLabel } from "../helper/workspaceRoles";
import { useWorkspace, useWorkspaces } from "../queries/hooks";
import { errorMessage } from "../services/apiClient";
import { createWorkspace, deleteWorkspace, renameWorkspace, transferWorkspace } from "../services/workspaceServices";

function WorkspacesModal({ setOpen }: { setOpen: (v: boolean) => void }) {
  const myId: string = useSelector((state: any) => state.authReducer.myUserProfile?._id);
  const list = useWorkspaces();
  const workspaces: any[] = list.data ?? [];
  const [selected, setSelected] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [newName, setNewName] = useState("");
  const [creating, setCreating] = useState(false);

  // Keep a valid selection: the first workspace to begin with, and a neighbour after leaving or deleting one.
  useEffect(() => {
    if (!list.data) return;
    if (!selected || !list.data.some((w: any) => w._id === selected)) setSelected(list.data[0]?._id ?? null);
  }, [list.data, selected]);

  const detailQuery = useWorkspace(selected);
  const detail = detailQuery.data;
  const myRole = detail?.myRole;

  const create = async (e: React.FormEvent) => {
    e.preventDefault();
    if (newName.trim().length < 2) return setNotice("A workspace name needs at least 2 characters.");
    setCreating(true);
    const res: any = await createWorkspace(newName.trim());
    setCreating(false);
    if (!res?._id) return setNotice(errorMessage(res, "Could not create the workspace."));
    setNotice(null);
    setNewName("");
    setSelected(res._id);
  };

  return (
    <ModalOverlay onClose={() => setOpen(false)}>
      <div className="bg-C55 rounded-[8px] p-5 w-[95%] max-w-[920px] h-[85vh] flex flex-col shadow-xl text-C11">
        <div className="flex flex-row items-center justify-between pb-3">
          <div className="font-bold text-[20px]">Workspaces</div>
          <button onClick={() => setOpen(false)} aria-label="Close" className="cursor-pointer">
            <Close sx={{ fontSize: 20 }} />
          </button>
        </div>

        {notice && (
          <div role="alert" className="mb-2 rounded-[4px] bg-inactiveRed text-highPriority text-[12px] font-semibold px-2 py-1">
            {notice}
          </div>
        )}

        <div className="flex flex-col md:flex-row gap-4 flex-1 min-h-0">
          <nav aria-label="Your workspaces" className="md:w-[250px] flex flex-col gap-2 md:overflow-y-auto shrink-0">
            {list.isPending && <p className="text-[12px] text-gray-500">Loading...</p>}
            {list.isError && !list.data && <p role="alert" className="text-[12px] text-highPriority font-semibold">{errorMessage(list.error, "Could not load workspaces.")}</p>}
            <ul className="flex flex-col gap-1">
              {workspaces.map((w) => (
                <li key={w._id}>
                  <button
                    onClick={() => {
                      setSelected(w._id);
                      setNotice(null);
                    }}
                    aria-current={selected === w._id}
                    className={`w-full text-left rounded-[6px] px-3 py-2 ${selected === w._id ? "bg-[#012b3927]" : "hover:bg-C44"}`}
                  >
                    <div className="text-[13px] font-bold truncate">{w.name}</div>
                    <div className="text-[11px] text-gray-500">{`${roleLabel(w.myRole)} · ${w.memberCount} member${w.memberCount === 1 ? "" : "s"} · ${w.projectCount} project${w.projectCount === 1 ? "" : "s"}`}</div>
                  </button>
                </li>
              ))}
            </ul>
            <form onSubmit={create} className="flex flex-col gap-2 mt-1">
              <label className="text-[11px] font-bold text-gray-500" htmlFor="new-workspace">New workspace</label>
              <input
                id="new-workspace"
                value={newName}
                maxLength={60}
                onChange={(e) => setNewName(e.target.value)}
                placeholder="e.g. Acme Co"
                className="bg-C44 rounded-[6px] px-2 py-2 text-[13px]"
              />
              <button type="submit" disabled={creating || !newName.trim()} className="bg-[#012b39f2] hover:bg-[#012B39] disabled:opacity-50 rounded-[8px] text-white font-bold text-[12px] py-2">
                {creating ? "Creating..." : "Create workspace"}
              </button>
            </form>
          </nav>

          <div className="flex-1 min-w-0 overflow-y-auto md:pl-4 md:border-l border-C44">
            {list.data && workspaces.length === 0 && (
              <div className="py-8 text-center text-[13px] text-gray-600">
                <p className="font-bold text-[15px] text-C11">You are not in a workspace yet</p>
                <p className="mt-1">Create one on the left, or open the invitation link someone sent you.</p>
              </div>
            )}
            {selected && detailQuery.isPending && <p className="text-[12px] text-gray-500">Loading...</p>}
            {selected && detailQuery.isError && !detail && <p role="alert" className="text-[12px] text-highPriority font-semibold">{errorMessage(detailQuery.error, "Could not load this workspace.")}</p>}

            {detail && (
              <div className="flex flex-col gap-6">
                <Header workspace={detail} onError={setNotice} />
                <MembersSection
                  workspaceId={detail._id}
                  members={detail.members}
                  myRole={detail.myRole}
                  myId={myId}
                  onError={setNotice}
                  onLeft={() => setSelected(null)}
                />
                {canManage(myRole) && <InvitesSection workspaceId={detail._id} myRole={detail.myRole} onError={setNotice} />}
                {isOwner(myRole) && <OwnerActions workspace={detail} myId={myId} onError={setNotice} onDeleted={() => setSelected(null)} />}
              </div>
            )}
          </div>
        </div>
      </div>
    </ModalOverlay>
  );
}

function Header({ workspace, onError }: { workspace: any; onError: (m: string | null) => void }) {
  const [editing, setEditing] = useState(false);
  const [name, setName] = useState(workspace.name);
  const editable = canManage(workspace.myRole);

  const save = async () => {
    setEditing(false);
    const next = name.trim();
    if (next === workspace.name) return;
    if (next.length < 2) {
      setName(workspace.name);
      return onError("A workspace name needs at least 2 characters.");
    }
    const res: any = await renameWorkspace(workspace._id, next);
    if (res?.name) onError(null);
    else {
      setName(workspace.name);
      onError(errorMessage(res, "Could not rename the workspace."));
    }
  };

  return (
    <div>
      {editing ? (
        <input
          autoFocus
          aria-label="Workspace name"
          value={name}
          maxLength={60}
          onChange={(e) => setName(e.target.value)}
          onBlur={save}
          onKeyDown={(e) => {
            if (e.key === "Escape") {
              e.nativeEvent.stopImmediatePropagation(); // cancel the rename, not the whole dialog
              setName(workspace.name);
              setEditing(false);
            }
            if (e.key === "Enter") save();
          }}
          className="w-full bg-C44 rounded-[6px] px-2 py-1 text-[20px] font-extrabold"
        />
      ) : (
        <h2 className="text-[20px] font-extrabold break-words">
          {editable ? (
            <button
              onClick={() => {
                setName(workspace.name);
                setEditing(true);
              }}
              title="Click to rename"
              className="text-left w-full rounded-[6px] hover:bg-C44 px-1 -mx-1"
            >
              {workspace.name}
            </button>
          ) : (
            workspace.name
          )}
        </h2>
      )}
      <p className="text-[12px] text-gray-500 mt-1">{`You are ${workspace.myRole === "admin" ? "an admin" : workspace.myRole === "owner" ? "the owner" : "a member"} · ${workspace.projectCount} project${workspace.projectCount === 1 ? "" : "s"} you can see`}</p>
    </div>
  );
}

function OwnerActions({ workspace, myId, onError, onDeleted }: { workspace: any; myId: string; onError: (m: string | null) => void; onDeleted: () => void }) {
  const others = workspace.members.filter((m: any) => m.user._id !== myId);
  const [target, setTarget] = useState("");

  const transfer = async () => {
    if (!target) return onError("Choose who should become the owner.");
    const res: any = await transferWorkspace(workspace._id, target);
    onError(res?.owner ? null : errorMessage(res, "Could not transfer ownership."));
    if (res?.owner) setTarget("");
  };
  const remove = async () => {
    const res: any = await deleteWorkspace(workspace._id);
    if (!res?.deleted) return onError(errorMessage(res, "Could not delete the workspace."));
    onError(null);
    onDeleted();
  };

  return (
    <section aria-labelledby="owner-h" className="border-t border-C44 pt-4">
      <h3 id="owner-h" className="text-[13px] font-bold mb-2">Owner actions</h3>
      <div className="flex flex-row flex-wrap items-center gap-2">
        <select aria-label="New owner" value={target} onChange={(e) => setTarget(e.target.value)} disabled={others.length === 0} className="bg-C44 rounded-[6px] text-[12px] px-2 py-2 disabled:opacity-50">
          <option value="">{others.length ? "Transfer ownership to..." : "No one else to hand over to"}</option>
          {others.map((m: any) => (
            <option key={m.user._id} value={m.user._id}>{`${m.user.firstName} ${m.user.lastName}`}</option>
          ))}
        </select>
        <ConfirmButton label="Transfer" confirmLabel="Transfer?" disabled={!target} onConfirm={transfer} className="text-[12px] font-bold rounded-[6px] px-3 py-2 bg-C44 hover:bg-[#012b3927]" />
      </div>
      <div className="mt-3">
        <ConfirmButton
          label="Delete workspace"
          aria-label="Delete this workspace"
          confirmLabel="Delete for good?"
          onConfirm={remove}
          className="text-[12px] font-bold rounded-[6px] px-3 py-2 text-highPriority hover:bg-inactiveRed"
        />
        <p className="text-[11px] text-gray-500 mt-1">A workspace can only be deleted once it has no projects.</p>
      </div>
    </section>
  );
}

export default WorkspacesModal;

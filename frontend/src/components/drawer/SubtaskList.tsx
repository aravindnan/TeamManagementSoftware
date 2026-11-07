import React, { useState } from "react";
import { Close } from "@mui/icons-material";
import { useQueryClient } from "@tanstack/react-query";
import { qk } from "../../queries/keys";
import { addSubtask, deleteSubtask, updateSubtask } from "../../services/taskServices";
import { errorMessage } from "../../services/apiClient";

interface Subtask {
  _id: string;
  title: string;
  done: boolean;
}

interface Props {
  taskId: string;
  subtasks: Subtask[];
  canEdit: boolean;
  onError: (message: string) => void;
}

function SubtaskList({ taskId, subtasks, canEdit, onError }: Props) {
  const client = useQueryClient();
  const [title, setTitle] = useState("");

  const done = subtasks.filter((s) => s.done).length;
  const percent = subtasks.length ? Math.round((done / subtasks.length) * 100) : 0;
  const restore = () => client.invalidateQueries({ queryKey: qk.task(taskId) });

  const add = async () => {
    const text = title.trim();
    if (!text) return;
    setTitle(""); // ready for the next one immediately; text typed while this saves must not be lost
    const res: any = await addSubtask(taskId, text); // the cache layer writes the returned list into the task
    if (!res?.subtasks) {
      setTitle((current) => current || text); // give the text back, unless they have already started another
      onError(errorMessage(res, "Could not add the sub-task."));
    }
  };

  const toggle = async (s: Subtask) => {
    // optimistic: tick it now, confirm (or undo) when the server answers
    client.setQueryData(qk.task(taskId), (old: any) =>
      old ? { ...old, subtasks: old.subtasks.map((x: Subtask) => (x._id === s._id ? { ...x, done: !x.done } : x)) } : old
    );
    const res: any = await updateSubtask(taskId, s._id, { done: !s.done });
    if (!res?.subtasks) {
      restore();
      onError(errorMessage(res, "Could not update the sub-task."));
    }
  };

  const remove = async (s: Subtask) => {
    const res: any = await deleteSubtask(taskId, s._id);
    if (!res?.subtasks) onError(errorMessage(res, "Could not remove the sub-task."));
  };

  return (
    <section aria-labelledby="subtasks-h">
      <div className="flex flex-row items-center justify-between mb-1">
        <h3 id="subtasks-h" className="text-[12px] font-bold text-C11">
          Sub-tasks
        </h3>
        {subtasks.length > 0 && <span className="text-[10px] font-semibold text-gray-500">{`${done}/${subtasks.length}`}</span>}
      </div>

      {subtasks.length > 0 && (
        <div
          role="progressbar"
          aria-label="Sub-task progress"
          aria-valuemin={0}
          aria-valuemax={100}
          aria-valuenow={percent}
          className="h-[4px] rounded-full bg-C44 mb-2 overflow-hidden"
        >
          <div className="h-full bg-C22 transition-all" style={{ width: `${percent}%` }} />
        </div>
      )}

      <ul className="flex flex-col gap-1">
        {subtasks.map((s) => (
          <li key={s._id} className="flex flex-row items-center gap-2 group">
            <input
              type="checkbox"
              checked={s.done}
              disabled={!canEdit}
              onChange={() => toggle(s)}
              aria-label={`${s.done ? "Reopen" : "Complete"} ${s.title}`}
            />
            <span className={`flex-1 text-[13px] break-words ${s.done ? "line-through text-gray-500" : ""}`}>{s.title}</span>
            {canEdit && (
              <button
                aria-label={`Remove sub-task ${s.title}`}
                onClick={() => remove(s)}
                className="opacity-0 group-hover:opacity-100 focus:opacity-100 text-gray-500 hover:text-highPriority"
              >
                <Close sx={{ fontSize: 14 }} />
              </button>
            )}
          </li>
        ))}
        {subtasks.length === 0 && !canEdit && <li className="text-[12px] text-gray-500">No sub-tasks</li>}
      </ul>

      {canEdit && (
        <form
          className="flex flex-row gap-2 mt-2"
          onSubmit={(e) => {
            e.preventDefault();
            add();
          }}
        >
          <input
            value={title}
            maxLength={200}
            onChange={(e) => setTitle(e.target.value)}
            aria-label="New sub-task"
            placeholder="Add a sub-task"
            className="flex-1 bg-C44 rounded-[6px] px-2 py-1 text-[12px]"
          />
          <button
            type="submit"
            disabled={!title.trim()}
            className="bg-[#012b39f2] hover:bg-[#012B39] disabled:opacity-50 rounded-[8px] text-white font-bold text-[12px] py-1 px-3"
          >
            Add
          </button>
        </form>
      )}
    </section>
  );
}

export default SubtaskList;

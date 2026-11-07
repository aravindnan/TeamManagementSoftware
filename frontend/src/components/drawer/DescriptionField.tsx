import React, { useState } from "react";
import { Markdown } from "../../helper/markdown";
import { stopEscape } from "./useDraft";

interface Props {
  value: string;
  canEdit: boolean;
  /** Resolves true when saved. The editor stays open (with the text intact) when it resolves false. */
  onSave: (value: string) => Promise<boolean>;
}

const MAX = 5000;

function DescriptionField({ value, canEdit, onSave }: Props) {
  const [editing, setEditing] = useState(false);
  const [preview, setPreview] = useState(false);
  const [draft, setDraft] = useState(value);
  const [saving, setSaving] = useState(false);

  const start = () => {
    setDraft(value);
    setPreview(false);
    setEditing(true);
  };
  const cancel = () => setEditing(false);
  const save = async () => {
    if (draft === value) return cancel();
    setSaving(true);
    const ok = await onSave(draft);
    setSaving(false);
    if (ok) setEditing(false);
  };

  if (!editing) {
    return (
      <div>
        {value.trim() ? (
          <Markdown source={value} />
        ) : (
          <p className="text-[12px] text-gray-500 italic">{canEdit ? "No description yet." : "No description."}</p>
        )}
        {canEdit && (
          <button onClick={start} className="mt-2 text-[11px] font-bold text-C22 hover:text-C11">
            {value.trim() ? "Edit description" : "Add a description"}
          </button>
        )}
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-2">
      <div role="group" aria-label="Description mode" className="flex flex-row gap-1">
        {([[false, "Write"], [true, "Preview"]] as [boolean, string][]).map(([val, label]) => (
          <button
            key={label}
            aria-pressed={preview === val}
            onClick={() => setPreview(val)}
            className={`rounded-[6px] font-bold text-[10px] py-1 px-2 ${preview === val ? "bg-[#012b3927] text-C11" : "text-gray-500"}`}
          >
            {label}
          </button>
        ))}
      </div>

      {preview ? (
        <div className="bg-white rounded-[6px] p-2 min-h-[120px]">
          {draft.trim() ? <Markdown source={draft} /> : <p className="text-[12px] text-gray-500 italic">Nothing to preview.</p>}
        </div>
      ) : (
        <textarea
          autoFocus
          aria-label="Description"
          value={draft}
          maxLength={MAX}
          rows={9}
          onChange={(e) => setDraft(e.target.value)}
          onKeyDown={(e) => {
            stopEscape(e);
            if (e.key === "Escape") cancel();
            if (e.key === "Enter" && (e.metaKey || e.ctrlKey)) {
              e.preventDefault();
              save();
            }
          }}
          placeholder="Describe the work. Markdown is supported: **bold**, lists, `code`, [links](https://...)"
          className="bg-C44 rounded-[6px] p-2 text-[13px] font-mono resize-y"
        />
      )}

      <div className="flex flex-row items-center justify-between">
        <span className="text-[10px] text-gray-500">{`${draft.length}/${MAX} · Ctrl+Enter to save`}</span>
        <div className="flex flex-row gap-2">
          <button onClick={cancel} className="rounded-[8px] hover:bg-[#012b3927] text-C11 font-bold text-[12px] py-1 px-3">
            Cancel
          </button>
          <button
            onClick={save}
            disabled={saving}
            className="bg-[#012b39f2] hover:bg-[#012B39] disabled:opacity-60 rounded-[8px] text-white font-bold text-[12px] py-1 px-3"
          >
            {saving ? "Saving..." : "Save"}
          </button>
        </div>
      </div>
    </div>
  );
}

export default DescriptionField;

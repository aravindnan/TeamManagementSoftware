import React, { useEffect, useRef, useState } from "react";
import { Close } from "@mui/icons-material";
import { addLabel } from "../../helper/labels";

interface Props {
  /** The saved labels. */
  labels: string[];
  canEdit: boolean;
  /** Saves the complete list. Resolves true when the server accepted it. */
  onChange: (labels: string[]) => Promise<boolean>;
}

function LabelEditor({ labels: saved, canEdit, onChange }: Props) {
  const [text, setText] = useState("");
  const [error, setError] = useState<string | null>(null);

  // What is shown, and what the next edit builds on. It changes the instant the user acts, so two quick edits
  // both survive (each save carries the full list); the server's copy is only adopted once nothing is in flight.
  const [labels, setLabels] = useState(saved);
  const inFlight = useRef(0);
  const savedRef = useRef(saved);
  savedRef.current = saved;
  useEffect(() => {
    if (inFlight.current === 0) setLabels(saved);
  }, [saved]);

  const apply = async (next: string[]) => {
    setLabels(next);
    inFlight.current += 1;
    const ok = await onChange(next);
    inFlight.current -= 1;
    if (!ok && inFlight.current === 0) setLabels(savedRef.current); // refused: go back to what the server has
  };

  const commit = () => {
    if (!text.trim()) return;
    const result = addLabel(labels, text);
    if (result.error) {
      setError(result.error);
      return;
    }
    setError(null);
    setText("");
    if (result.labels !== labels) apply(result.labels);
  };

  return (
    <div className="flex flex-col gap-1">
      <div className="flex flex-row flex-wrap items-center gap-1">
        {labels.length === 0 && !canEdit && <span className="text-[12px] text-gray-500">No labels</span>}
        {labels.map((label) => (
          <span key={label} className="flex flex-row items-center gap-1 bg-C44 text-C11 rounded-[4px] pl-2 pr-1 py-[2px] text-[11px] font-semibold">
            {label}
            {canEdit && (
              <button
                aria-label={`Remove label ${label}`}
                onClick={() => apply(labels.filter((l) => l !== label))}
                className="rounded-full hover:bg-[#012b3927] flex items-center"
              >
                <Close sx={{ fontSize: 12 }} />
              </button>
            )}
          </span>
        ))}
        {canEdit && (
          <input
            value={text}
            aria-label="Add a label"
            placeholder={labels.length ? "Add label" : "Add a label"}
            onChange={(e) => {
              setText(e.target.value);
              setError(null);
            }}
            onKeyDown={(e) => {
              if (e.key === "Enter" || e.key === ",") {
                e.preventDefault();
                commit();
              }
            }}
            onBlur={commit}
            className="bg-C44 rounded-[4px] px-2 py-[2px] text-[11px] w-[110px]"
          />
        )}
      </div>
      {error && (
        <div role="alert" className="text-[10px] text-highPriority font-semibold">
          {error}
        </div>
      )}
    </div>
  );
}

export default LabelEditor;

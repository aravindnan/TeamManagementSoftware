import React, { useEffect, useRef, useState } from "react";

/** A read-only link with a Copy button. Falls back to selecting the text when the clipboard is unavailable. */
function CopyField({ value, label }: { value: string; label: string }) {
  const input = useRef<HTMLInputElement>(null);
  const [copied, setCopied] = useState(false);
  useEffect(() => {
    if (!copied) return;
    const t = setTimeout(() => setCopied(false), 2000);
    return () => clearTimeout(t);
  }, [copied]);

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(value);
      setCopied(true);
    } catch {
      input.current?.select(); // the user can press Ctrl/Cmd+C
    }
  };

  return (
    <div className="flex flex-row gap-2">
      <input
        ref={input}
        readOnly
        aria-label={label}
        value={value}
        onFocus={(e) => e.currentTarget.select()}
        className="flex-1 min-w-0 bg-white rounded-[6px] px-2 py-1 text-[12px] font-mono"
      />
      <button onClick={copy} className="bg-[#012b39f2] hover:bg-[#012B39] rounded-[8px] text-white font-bold text-[12px] px-3">
        {copied ? "Copied" : "Copy"}
      </button>
    </div>
  );
}

export default CopyField;

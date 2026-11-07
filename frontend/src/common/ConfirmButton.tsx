import React, { useEffect, useState } from "react";

interface Props {
  label: string;
  confirmLabel?: string;
  onConfirm: () => void;
  className?: string;
  disabled?: boolean;
  "aria-label"?: string;
}

/** A destructive action needs a second click. It disarms itself after a few seconds so it cannot be clicked by accident later. */
function ConfirmButton({ label, confirmLabel = "Confirm?", onConfirm, className = "", disabled, ...rest }: Props) {
  const [armed, setArmed] = useState(false);
  useEffect(() => {
    if (!armed) return;
    const t = setTimeout(() => setArmed(false), 4000);
    return () => clearTimeout(t);
  }, [armed]);

  return (
    <button
      type="button"
      disabled={disabled}
      aria-label={armed ? `${confirmLabel} ${rest["aria-label"] || label}` : rest["aria-label"]}
      onClick={() => {
        if (!armed) return setArmed(true);
        setArmed(false);
        onConfirm();
      }}
      className={`${className} ${armed ? "bg-inactiveRed text-highPriority" : ""} disabled:opacity-50`}
    >
      {armed ? confirmLabel : label}
    </button>
  );
}

export default ConfirmButton;

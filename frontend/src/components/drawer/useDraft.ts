import { useEffect, useState } from "react";

/** Local editing state that follows the server value whenever it changes (e.g. after a save is confirmed). */
export function useDraft<T>(serverValue: T) {
  const [draft, setDraft] = useState<T>(serverValue);
  useEffect(() => setDraft(serverValue), [serverValue]);
  return [draft, setDraft] as const;
}

/**
 * The overlay closes on Escape at the document level. Inside an editor, Escape should only cancel the edit,
 * so editors call this first to keep the drawer open (and the rest of the draft safe).
 */
export function stopEscape(e: React.KeyboardEvent) {
  if (e.key === "Escape") e.nativeEvent.stopImmediatePropagation();
}

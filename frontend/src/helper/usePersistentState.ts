import { useCallback, useState } from "react";

/**
 * useState that remembers its value in localStorage (a per-viewer convenience such as a selected filter).
 * Storage can be blocked or full (private windows, strict settings), so every access is guarded and the app
 * simply behaves like plain useState when it is unavailable.
 */
export function usePersistentState(key: string, initial: string) {
  const [value, setValue] = useState<string>(() => {
    try {
      return window.localStorage.getItem(key) ?? initial;
    } catch {
      return initial;
    }
  });
  const update = useCallback(
    (next: string) => {
      setValue(next);
      try {
        window.localStorage.setItem(key, next);
      } catch {
        /* ignore: not persisted, still works for this visit */
      }
    },
    [key]
  );
  return [value, update] as const;
}

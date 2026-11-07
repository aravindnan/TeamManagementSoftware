// Mirrors the server's rules (backend/schemas/index.js) so mistakes are caught before a round trip.
export const MAX_LABELS = 8;
export const MAX_LABEL_LENGTH = 24;
const LABEL_PATTERN = /^[a-z0-9][a-z0-9 _-]*$/;

export type LabelResult = { ok: true; label: string } | { ok: false; reason: string };

export function normalizeLabel(raw: string): LabelResult {
  const label = raw.trim().toLowerCase();
  if (!label) return { ok: false, reason: "Type a label first" };
  if (label.length > MAX_LABEL_LENGTH) return { ok: false, reason: `Labels are at most ${MAX_LABEL_LENGTH} characters` };
  if (!LABEL_PATTERN.test(label)) return { ok: false, reason: "Use letters, numbers, spaces, - or _" };
  return { ok: true, label };
}

/** Adds a label to a list, or says why not. Duplicates are ignored silently (the list is unchanged). */
export function addLabel(labels: string[], raw: string): { labels: string[]; error?: string } {
  const result = normalizeLabel(raw);
  if (!result.ok) return { labels, error: result.reason };
  if (labels.includes(result.label)) return { labels };
  if (labels.length >= MAX_LABELS) return { labels, error: `A task can have at most ${MAX_LABELS} labels` };
  return { labels: [...labels, result.label] };
}

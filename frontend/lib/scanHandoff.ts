/**
 * One-shot text hand-off between any "scan this" CTA (hero textarea,
 * dashboard DropCard, etc.) and the /editor page.
 *
 * Lives in sessionStorage rather than a URL query param because pasted
 * content can hit the 5,000-char input cap, which would blow past safe
 * URL lengths.
 */
const KEY = "heynotai.scan.pending";

export interface PendingScan {
  text: string;
  ts: number;
}

export function setPendingScan(text: string): void {
  if (typeof window === "undefined") return;
  try {
    sessionStorage.setItem(KEY, JSON.stringify({ text, ts: Date.now() }));
  } catch {
    /* sessionStorage may be disabled — fall back to in-memory below */
    inMemory = { text, ts: Date.now() };
  }
}

export function consumePendingScan(): PendingScan | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = sessionStorage.getItem(KEY);
    if (raw) {
      sessionStorage.removeItem(KEY);
      return JSON.parse(raw) as PendingScan;
    }
  } catch {
    /* fall through to memory */
  }
  if (inMemory) {
    const v = inMemory;
    inMemory = null;
    return v;
  }
  return null;
}

let inMemory: PendingScan | null = null;

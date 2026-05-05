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
  // React Strict Mode + Next dev re-runs effects, so this can be called
  // twice in quick succession. Cache the most recent consumption briefly
  // so the second call returns the same value instead of null.
  const now = Date.now();
  if (lastConsumed && now - lastConsumed.ts < 1500) {
    return lastConsumed;
  }
  let result: PendingScan | null = null;
  try {
    const raw = sessionStorage.getItem(KEY);
    if (raw) {
      sessionStorage.removeItem(KEY);
      result = JSON.parse(raw) as PendingScan;
    }
  } catch {
    /* fall through to memory */
  }
  if (!result && inMemory) {
    result = inMemory;
    inMemory = null;
  }
  if (result) lastConsumed = { ...result, ts: now };
  return result;
}

let inMemory: PendingScan | null = null;
let lastConsumed: PendingScan | null = null;

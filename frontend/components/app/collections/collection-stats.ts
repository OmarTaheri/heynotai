import { formatRelative } from "@/lib/library-data";
import type { CollectionItem } from "@/lib/collections-data";

const FLAG_THRESHOLD = 50;

export type CollectionStatsSummary = {
  itemCount: number;
  graded: number;
  pending: number;
  flagged: number;
  /** Whole-number AI rate 0–100 (flagged / itemCount). */
  aiPct: number;
  /** Relative timestamp of the most recent scan, e.g. "2h ago". `—` when empty. */
  lastScannedRelative: string;
  lastScannedSubtitle: string;
  /** Total tokens charged across this collection's scans. */
  tokensUsed: number;
  /** Subtitle under the tokens tile, e.g. "avg 12 / item" or "no items yet". */
  tokensSubtitle: string;
};

export function computeCollectionStats(
  items: CollectionItem[],
): CollectionStatsSummary {
  const total = items.length;
  let graded = 0;
  let pending = 0;
  let flagged = 0;
  let tokensUsed = 0;
  let mostRecentIso = "";

  for (const it of items) {
    const status = it.status ?? "done";
    if (status === "done") graded++;
    else pending++;

    const ai = it.aiPct ?? it.confidence ?? 0;
    if (ai >= FLAG_THRESHOLD) flagged++;

    const iso = it.whenIso ?? "";
    if (iso && iso > mostRecentIso) mostRecentIso = iso;

    tokensUsed += Math.max(0, it.tokensUsed ?? 0);
  }

  const aiPct = total === 0 ? 0 : Math.round((flagged / total) * 100);

  let tokensSubtitle: string;
  if (total === 0) {
    tokensSubtitle = "no items yet";
  } else {
    const avg = Math.round(tokensUsed / total);
    tokensSubtitle = `avg ${avg.toLocaleString()} / item`;
  }

  return {
    itemCount: total,
    graded,
    pending,
    flagged,
    aiPct,
    lastScannedRelative: mostRecentIso ? formatRelative(mostRecentIso) : "—",
    lastScannedSubtitle:
      total === 0
        ? "no items yet"
        : `across ${total} item${total === 1 ? "" : "s"}`,
    tokensUsed,
    tokensSubtitle,
  };
}

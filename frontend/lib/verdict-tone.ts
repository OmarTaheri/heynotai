/** Three-bucket split used by the collection table verdict badge.
 *  Mirrors the thresholds in `scan-types.ts` (`scanResultToEngineEntry`)
 *  and `editor-shell/ScoreRing.tsx` (`verdictFromScore` over authenticity)
 *  so the same scan reads as the same verdict in every surface. */

export type VerdictTone = "human" | "mixed" | "ai";

export function verdictToneFromAiPct(aiPct: number): VerdictTone {
  if (aiPct >= 70) return "ai";
  if (aiPct >= 40) return "mixed";
  return "human";
}

export function verdictLabelFromAiPct(
  aiPct: number,
): "Not AI" | "Medium" | "AI" {
  const tone = verdictToneFromAiPct(aiPct);
  if (tone === "ai") return "AI";
  if (tone === "mixed") return "Medium";
  return "Not AI";
}

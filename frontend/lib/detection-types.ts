/**
 * Shared verdict + flag types used by the /editor surface.
 * Mirrors the shape used in the extension (`extension/lib/types.ts`)
 * so the same scan payload can power both surfaces once the API ships.
 */

export type Verdict = "human" | "ai" | "mixed";
export type FlagKind = "gen" | "match" | "plag";

export interface AiFlag {
  /** Stable id used to cross-reference editor decoration ↔ panel card. */
  id: string;
  /** ProseMirror absolute positions (1-indexed for nodes). */
  from: number;
  to: number;
  kind: FlagKind;
  /** 0-100 */
  confidence: number;
  /** Short human-readable label shown in the panel card header. */
  label: string;
  /** Optional model-match details (logo, name, vendor). */
  match?: { vendor: "openai" | "anthropic" | "google"; name: string };
  /** Optional plagiarism source (URL + quoted snippet). */
  source?: { url: string; quote: string };
}

export interface ScanResult {
  /** Overall authenticity 0-100 (higher = more human). */
  authenticity: number;
  /** Per-category percentages (0-100). */
  breakdown: { gen: number; match: number; plag: number };
  flags: AiFlag[];
}

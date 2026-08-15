import type { Scan } from "./scan-types";
import type { ScanType as TypeChipType } from "@/components/ui/TypeChip";
import type {
  LastScan,
  ProseSegment,
  SignalBar,
  ScanVerdict as CardVerdict,
} from "@/components/app/home/LastScanCard";
import type { AiFlag } from "./detection-types";
import { deriveItemMeta, metaSegments } from "./item-meta";
import { formatRelative } from "./library-data";

const ORIGIN_LABEL: Record<Scan["origin"], string> = {
  paste: "PASTE",
  link: "LINK",
  upload: "UPLOAD",
  record: "RECORDING",
  ext: "EXTENSION",
  url: "URL",
  mon: "MONITOR",
};

const VERDICT_LABEL: Record<CardVerdict, string> = {
  ai: "Likely AI-written",
  human: "Likely human",
};

export function scanToLastScan(scan: Scan): LastScan {
  const type = (scan.subtype as TypeChipType) || (scan.type as TypeChipType);
  const verdict: CardVerdict = scan.verdict === "human" ? "human" : "ai";

  const filename = (scan.title?.trim() || "Untitled scan").replace(/\s+/g, " ");

  const parts = deriveItemMeta(scan);
  const tail = metaSegments(type, parts);
  const meta = [ORIGIN_LABEL[scan.origin] ?? "SCAN", ...tail, formatRelative(scan.created)]
    .filter(Boolean)
    .join(" · ");

  const score = clamp0to100(scan.aiPct);

  return {
    id: scan.id,
    type,
    filename,
    meta,
    verdict,
    verdictLabel: VERDICT_LABEL[verdict],
    score,
    closestModel: scan.model || "—",
    ci: buildCi(scan),
    prose: buildProse(scan),
    signals: buildSignals(scan, score),
  };
}

function clamp0to100(n: number | undefined): number {
  const v = Number(n ?? 0);
  if (!Number.isFinite(v)) return 0;
  return Math.max(0, Math.min(100, Math.round(v)));
}

function buildCi(scan: Scan): string {
  const conf = clamp0to100(scan.confidence);
  const when = scan.scanCompletedAt || scan.updated || scan.created;
  const rel = when ? formatRelative(when) : "";
  if (conf > 0 && rel) return `Confidence ${conf}% · scanned ${rel}`;
  if (conf > 0) return `Confidence ${conf}%`;
  if (rel) return `Scanned ${rel}`;
  return "—";
}

/* ── Prose with inline AI highlights ─────────────────────────────────
   Renders the first ~2 paragraphs of `scan.content` and wraps any
   `kind: "gen"` flag's range in a highlight span. AiFlag positions are
   ProseMirror-absolute (1-indexed: pos 1 = start of first paragraph,
   each "\n\n" split costs 2 positions for </p><p>). We map that back
   onto string offsets so highlights line up with the rendered prose.
   Best-effort — flags whose range falls outside the rendered snippet
   are skipped silently rather than mis-highlighting the wrong text. */
const MAX_PARAGRAPHS = 2;
const MAX_CHARS = 700;

function buildProse(scan: Scan): ProseSegment[][] {
  const content = (scan.content ?? "").trim();
  if (!content) {
    return [
      [
        {
          text:
            scan.type === "txt"
              ? "No excerpt yet — open the full view to see this scan."
              : `${scan.type.toUpperCase()} scan · open the full view for the verdict breakdown.`,
        },
      ],
    ];
  }

  const paragraphs = splitParagraphs(content).slice(0, MAX_PARAGRAPHS);

  let pmCursor = 1;
  let charsLeft = MAX_CHARS;
  const out: ProseSegment[][] = [];

  for (const para of paragraphs) {
    if (charsLeft <= 0) break;
    const truncated = para.length > charsLeft ? para.slice(0, charsLeft - 1) + "…" : para;
    charsLeft -= truncated.length;

    const paraStart = pmCursor + 1;
    const paraEnd = paraStart + truncated.length;
    const flags = (scan.flags ?? [])
      .filter(
        (f: AiFlag) =>
          f.kind === "gen" &&
          f.from >= paraStart &&
          f.to > f.from &&
          f.from < paraEnd,
      )
      .map((f) => ({ from: f.from, to: Math.min(f.to, paraEnd) }))
      .sort((a, b) => a.from - b.from);

    if (flags.length === 0) {
      out.push([{ text: truncated }]);
    } else {
      const segs: ProseSegment[] = [];
      let cur = paraStart;
      for (const f of flags) {
        if (f.from > cur) {
          segs.push({ text: truncated.slice(cur - paraStart, f.from - paraStart) });
        }
        segs.push({
          text: truncated.slice(f.from - paraStart, f.to - paraStart),
          highlight: "ai",
        });
        cur = f.to;
      }
      if (cur < paraEnd) {
        segs.push({ text: truncated.slice(cur - paraStart) });
      }
      out.push(segs);
    }

    // Each paragraph break in PM costs 2 positions (</p><p>).
    pmCursor = paraEnd + 2;
  }

  return out;
}

function splitParagraphs(text: string): string[] {
  const parts = text.split(/\n\s*\n+/).map((p) => p.replace(/\s+/g, " ").trim());
  const nonEmpty = parts.filter(Boolean);
  return nonEmpty.length ? nonEmpty : [text.replace(/\s+/g, " ").trim()];
}

/* ── Signal breakdown bars ───────────────────────────────────────────
   Pulls every value from real scan data so the card stops lying. We
   prefer `scan.analysis` numeric fields when the engine populated them
   (HF text engines write `perplexity` / `burstiness` here), then fall
   back to `scan.breakdown` (gen / match / plag), then to top-level
   aiPct + confidence so the bars still render with sane numbers on
   legacy or sparsely-populated rows. */
function buildSignals(scan: Scan, score: number): SignalBar[] {
  const a = (scan.analysis ?? null) as Record<string, unknown> | null;
  const numFromAnalysis = (key: string): number | null => {
    const v = a?.[key];
    return typeof v === "number" && Number.isFinite(v)
      ? clamp0to100(v)
      : null;
  };
  const conf = clamp0to100(scan.confidence);
  const b = scan.breakdown;

  return [
    {
      name: "Perplexity",
      value: numFromAnalysis("perplexity") ?? score,
    },
    {
      name: "Burstiness",
      value: numFromAnalysis("burstiness") ?? conf,
    },
    {
      name: "Phrasing",
      value:
        numFromAnalysis("phrasing") ??
        (b ? clamp0to100(b.match) : Math.round((score + conf) / 2)),
    },
    {
      name: "Vocabulary",
      value:
        numFromAnalysis("vocabulary") ??
        (b ? clamp0to100(b.gen) : score),
    },
  ];
}

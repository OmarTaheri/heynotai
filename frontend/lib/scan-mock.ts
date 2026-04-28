import type { AiFlag, ScanResult } from "./detection-types";

/**
 * Deterministic mock scan used by /editor until the real detection API
 * lands. Picks a handful of phrases out of the document to underline so
 * the panel always has something to render.
 */
export function mockScan(text: string): ScanResult {
  const flags: AiFlag[] = [];

  // The top of the document in ProseMirror is position 1 (the doc node).
  // Each paragraph adds 1 for its open-tag and 1 for its close-tag, but
  // for a single-paragraph document seeded from a textarea the text
  // starts at offset 1.
  const PARA_START = 1;

  const phrases: { needle: string; kind: AiFlag["kind"]; conf: number; label: string }[] = [
    {
      needle: "compassionate, kind, and wonderful",
      kind: "gen",
      conf: 92,
      label: "Matches GPT-5 turbo patterns",
    },
    { needle: "always optimistic", kind: "gen", conf: 87, label: "Suspicious phrasing" },
    {
      needle: "approximately",
      kind: "match",
      conf: 68,
      label: "Claude 4.5 phrasing match",
    },
    {
      needle: "loves good for everyone",
      kind: "gen",
      conf: 78,
      label: "Suspicious phrasing",
    },
    {
      needle: "whoever meets her will also love her",
      kind: "plag",
      conf: 81,
      label: "1 source match",
    },
  ];

  let idCount = 0;
  for (const p of phrases) {
    const idx = text.toLowerCase().indexOf(p.needle.toLowerCase());
    if (idx === -1) continue;
    const from = PARA_START + idx;
    const to = from + p.needle.length;
    const flag: AiFlag = {
      id: `f${++idCount}`,
      from,
      to,
      kind: p.kind,
      confidence: p.conf,
      label: p.label,
    };
    if (p.kind === "match") {
      flag.match = { vendor: "anthropic", name: "Claude 4.5 sonnet" };
    } else if (p.kind === "gen") {
      flag.match = { vendor: "openai", name: "GPT-5 turbo" };
    } else if (p.kind === "plag") {
      flag.source = {
        url: "wikipedia.org/wiki/Mother",
        quote:
          "…anyone who meets her will love her too — a sentiment shared across personal essays in the corpus.",
      };
    }
    flags.push(flag);
  }

  // If the seeded text contains none of the canned phrases, fall back to
  // flagging the first 60 chars so the panel has at least one card to
  // demo the interaction.
  if (flags.length === 0 && text.trim().length > 0) {
    const len = Math.min(60, text.length);
    flags.push({
      id: "f1",
      from: PARA_START,
      to: PARA_START + len,
      kind: "gen",
      confidence: 71,
      label: "Suspicious phrasing",
      match: { vendor: "openai", name: "GPT-4o" },
    });
  }

  // Sum the flagged characters per kind, bounded to a 0-100 percentage.
  const total = Math.max(1, text.length);
  const sumLen = (k: AiFlag["kind"]) =>
    flags.filter((f) => f.kind === k).reduce((n, f) => n + (f.to - f.from), 0);
  const pct = (n: number) => Math.min(100, Math.round((n / total) * 100));

  const gen = pct(sumLen("gen"));
  const match = pct(sumLen("match"));
  const plag = pct(sumLen("plag"));
  const authenticity = Math.max(0, 100 - Math.round(gen * 0.6 + match * 0.25 + plag * 0.4));

  return { authenticity, breakdown: { gen, match, plag }, flags };
}

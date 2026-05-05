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

  return { authenticity, aiPct: gen, breakdown: { gen, match, plag }, flags };
}

/* ──────────────────────────────────────────────────────────────────────
   Image / video / audio mocks. They share the AiFlag shape — `from`/`to`
   are reinterpreted by each canvas:
     • image  : packed coords. from = packBox top-left, to = bottom-right.
                packBox(x, y) = x * 10000 + y, with x,y in 0–1000 (per-mille
                of width/height). decodeBox/decodePoint live in ImageCanvas.
     • video  : milliseconds.
     • audio  : milliseconds.
   ────────────────────────────────────────────────────────────────────── */

export function packBox(x: number, y: number): number {
  return Math.round(x) * 10000 + Math.round(y);
}
export function unpackBox(n: number): { x: number; y: number } {
  return { x: Math.floor(n / 10000), y: n % 10000 };
}

export function mockImageScan(): ScanResult {
  const flags: AiFlag[] = [
    {
      id: "im1",
      from: packBox(180, 140),
      to: packBox(560, 520),
      kind: "gen",
      confidence: 91,
      label: "Diffusion-model artifacts in face",
      match: { vendor: "openai", name: "DALL·E 3" },
    },
    {
      id: "im2",
      from: packBox(620, 320),
      to: packBox(880, 660),
      kind: "match",
      confidence: 76,
      label: "Stable Diffusion XL signature",
      match: { vendor: "google", name: "Imagen-trained features" },
    },
    {
      id: "im3",
      from: packBox(60, 720),
      to: packBox(420, 940),
      kind: "plag",
      confidence: 64,
      label: "Reused stock background",
      source: {
        url: "unsplash.com/photos/sunset-over-the-water-…",
        quote: "Backdrop matches a CC-licensed Unsplash photo with 87% similarity.",
      },
    },
  ];
  return {
    authenticity: 38,
    aiPct: 62,
    breakdown: { gen: 62, match: 41, plag: 18 },
    flags,
  };
}

export function mockVideoScan(durationMs: number = 30_000): ScanResult {
  const dur = Math.max(durationMs, 8_000);
  const flags: AiFlag[] = [
    {
      id: "vd1",
      from: Math.round(dur * 0.12),
      to: Math.round(dur * 0.22),
      kind: "gen",
      confidence: 88,
      label: "Lip-sync mismatch",
      match: { vendor: "openai", name: "Sora signature" },
    },
    {
      id: "vd2",
      from: Math.round(dur * 0.46),
      to: Math.round(dur * 0.58),
      kind: "match",
      confidence: 73,
      label: "Face-swap pattern",
      match: { vendor: "google", name: "Veo motion fingerprint" },
    },
    {
      id: "vd3",
      from: Math.round(dur * 0.78),
      to: Math.round(dur * 0.86),
      kind: "gen",
      confidence: 81,
      label: "Synthetic frame interpolation",
      match: { vendor: "openai", name: "Runway Gen-3" },
    },
  ];
  return {
    authenticity: 44,
    aiPct: 54,
    breakdown: { gen: 54, match: 36, plag: 0 },
    flags,
  };
}

export function mockAudioScan(durationMs: number = 30_000): ScanResult {
  const dur = Math.max(durationMs, 8_000);
  const flags: AiFlag[] = [
    {
      id: "au1",
      from: Math.round(dur * 0.08),
      to: Math.round(dur * 0.24),
      kind: "match",
      confidence: 92,
      label: "Voice clone — ElevenLabs match",
      match: { vendor: "openai", name: "ElevenLabs v2 voiceprint" },
    },
    {
      id: "au2",
      from: Math.round(dur * 0.38),
      to: Math.round(dur * 0.5),
      kind: "gen",
      confidence: 79,
      label: "Prosody anomaly",
      match: { vendor: "anthropic", name: "Synthetic-cadence model" },
    },
    {
      id: "au3",
      from: Math.round(dur * 0.66),
      to: Math.round(dur * 0.78),
      kind: "gen",
      confidence: 67,
      label: "Spectral discontinuity",
      match: { vendor: "openai", name: "TTS edit boundary" },
    },
  ];
  return {
    authenticity: 32,
    aiPct: 48,
    breakdown: { gen: 48, match: 58, plag: 0 },
    flags,
  };
}

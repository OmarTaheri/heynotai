import type { ContentKind } from './types';

export type Scope = 'all' | 'websites' | 'social' | 'facebook' | 'youtube' | 'instagram';
export type Range = 'today' | '7d' | '30d' | 'all';

export interface StatsBundle {
  scope: Scope;
  range: Range;
  totals: {
    scans: number;
    flagged: number;
    aiPercent: number;
    tokensUsed: number;
    tokensQuota: number;
  };
  verdict: { human: number; mixed: number; ai: number };
  trend: { day: string; human: number; mixed: number; ai: number }[];
  byType: { kind: ContentKind; flagged: number; total: number; spark: number[] }[];
  byPlatform: {
    key: 'facebook' | 'youtube' | 'instagram' | 'other';
    label: string;
    scans: number;
    aiPercent: number;
    spark: number[];
  }[];
  topSites: { host: string; scans: number; aiPercent: number }[];
  tokens: { text: number; image: number; audio: number; video: number; costUsd: number };
  confidence: number[];
  modelUsage: { group: ContentKind; modelName: string; scans: number }[];
  topAuthors: { name: string; flagged: number }[];
  streakDays: number;
  baselineAiPercent: number;
}

// ── Deterministic PRNG seeded by the filter combination ──────
function seedFrom(s: string): () => number {
  let h = 0;
  for (let i = 0; i < s.length; i++) h = ((h << 5) - h + s.charCodeAt(i)) | 0;
  let state = Math.abs(h) || 1;
  return () => {
    state = (state * 1664525 + 1013904223) | 0;
    return (state >>> 0) / 4294967296;
  };
}

function rangeDays(range: Range): number {
  return range === 'today' ? 1 : range === '7d' ? 7 : range === '30d' ? 30 : 90;
}

function rangeMultiplier(range: Range): number {
  return range === 'today' ? 0.08 : range === '7d' ? 0.4 : range === '30d' ? 1 : 2.4;
}

function scopeMultiplier(scope: Scope): number {
  switch (scope) {
    case 'all':       return 1;
    case 'websites':  return 0.55;
    case 'social':    return 0.45;
    case 'facebook':  return 0.18;
    case 'youtube':   return 0.17;
    case 'instagram': return 0.10;
  }
}

function scopeHumanAiBias(scope: Scope): number {
  // Higher = more AI content on this surface
  switch (scope) {
    case 'facebook':  return 0.55;
    case 'instagram': return 0.65;
    case 'youtube':   return 0.35;
    case 'social':    return 0.50;
    case 'websites':  return 0.30;
    case 'all':       return 0.42;
  }
}

function daysBack(n: number): string[] {
  const out: string[] = [];
  const now = new Date();
  for (let i = n - 1; i >= 0; i--) {
    const d = new Date(now);
    d.setDate(d.getDate() - i);
    out.push(`${d.getMonth() + 1}/${d.getDate()}`);
  }
  return out;
}

function int(rand: () => number, min: number, max: number): number {
  return Math.floor(min + rand() * (max - min + 1));
}

// ── Generator ─────────────────────────────────────────────────
export function getStats(scope: Scope, range: Range): StatsBundle {
  const rand = seedFrom(`${scope}-${range}`);
  const days = rangeDays(range);
  const mult = rangeMultiplier(range) * scopeMultiplier(scope);
  const aiBias = scopeHumanAiBias(scope);

  // Totals
  const scans = Math.round((800 + rand() * 1200) * mult);
  const aiCount = Math.round(scans * aiBias * (0.8 + rand() * 0.4));
  const mixedCount = Math.round(scans * 0.15 * (0.6 + rand() * 0.8));
  const humanCount = Math.max(0, scans - aiCount - mixedCount);
  const flagged = aiCount + mixedCount;
  const aiPercent = scans > 0 ? Math.round((aiCount / scans) * 100) : 0;

  const tokensQuota = 25_000;
  const tokensUsed = Math.min(tokensQuota, Math.round(scans * (3 + rand() * 5)));

  // Trend per day
  const trendDays = Math.min(days, 30);
  const dayLabels = daysBack(trendDays);
  const trend = dayLabels.map((day) => {
    const dayScans = Math.max(1, Math.round((scans / trendDays) * (0.5 + rand())));
    const dayAi = Math.round(dayScans * aiBias * (0.7 + rand() * 0.6));
    const dayMixed = Math.round(dayScans * 0.15 * (0.5 + rand()));
    const dayHuman = Math.max(0, dayScans - dayAi - dayMixed);
    return { day, human: dayHuman, mixed: dayMixed, ai: dayAi };
  });

  // By content type
  const kinds: ContentKind[] = ['text', 'image', 'audio', 'video'];
  const byType = kinds.map((kind) => {
    const weight = kind === 'text' ? 0.5 : kind === 'image' ? 0.3 : kind === 'video' ? 0.12 : 0.08;
    const total = Math.max(1, Math.round(scans * weight));
    const flagPct = kind === 'text' || kind === 'image' ? 0.4 + rand() * 0.3 : 0.2 + rand() * 0.3;
    const flg = Math.round(total * flagPct);
    const spark = Array.from({ length: 12 }, () => int(rand, 0, Math.max(1, Math.round(total / 8))));
    return { kind, flagged: flg, total, spark };
  });

  // By platform
  const platforms = [
    { key: 'facebook'  as const, label: 'Facebook',       weight: 0.18, aiWeight: 0.55 },
    { key: 'youtube'   as const, label: 'YouTube',        weight: 0.17, aiWeight: 0.30 },
    { key: 'instagram' as const, label: 'Instagram',      weight: 0.10, aiWeight: 0.62 },
    { key: 'other'     as const, label: 'Other websites', weight: 0.55, aiWeight: 0.30 },
  ];
  const byPlatform = platforms.map((p) => {
    const pScans = Math.round(scans * p.weight * (0.8 + rand() * 0.4));
    const pAi = Math.min(100, Math.round(p.aiWeight * 100 * (0.85 + rand() * 0.3)));
    const spark = Array.from({ length: 12 }, () => int(rand, 0, Math.max(1, Math.round(pScans / 8))));
    return { ...p, scans: pScans, aiPercent: pAi, spark };
  });

  // Top sites
  const hostPool = [
    'facebook.com', 'youtube.com', 'instagram.com', 'reddit.com',
    'x.com', 'linkedin.com', 'news.ycombinator.com', 'substack.com',
    'medium.com', 'nytimes.com', 'theverge.com',
  ];
  const shuffled = [...hostPool].sort(() => rand() - 0.5).slice(0, 5);
  const topSites = shuffled.map((host) => ({
    host,
    scans: int(rand, 20, Math.max(50, Math.round(scans * 0.3))),
    aiPercent: int(rand, 8, 72),
  })).sort((a, b) => b.scans - a.scans);

  // Token breakdown (rough per-kind weights)
  const tokens = {
    text:  Math.round(tokensUsed * 0.55),
    image: Math.round(tokensUsed * 0.22),
    audio: Math.round(tokensUsed * 0.08),
    video: Math.round(tokensUsed * 0.15),
    costUsd: +(tokensUsed * 0.00002).toFixed(2),
  };

  // Confidence distribution (10 buckets 0-10% … 90-100%)
  const confidence = Array.from({ length: 10 }, (_, i) => {
    // Center-heavy bell with a mild bump at the high end
    const center = 5;
    const dist = Math.abs(i - center);
    const base = Math.max(0, 20 - dist * 3);
    const bump = i >= 7 ? int(rand, 5, 15) : 0;
    return Math.round((base + bump) * (0.6 + rand() * 0.8) * (scans / 800));
  });

  // Model usage
  const modelUsage = [
    { group: 'text'  as const, modelName: 'heynotai Text v3',   scans: Math.round(scans * 0.50) },
    { group: 'image' as const, modelName: 'PixelForensics',      scans: Math.round(scans * 0.28) },
    { group: 'audio' as const, modelName: 'WaveScan',            scans: Math.round(scans * 0.09) },
    { group: 'video' as const, modelName: 'FrameDrift',          scans: Math.round(scans * 0.13) },
  ];

  // Top flagged authors
  const authorPool = [
    'Mira Okafor', 'Dan Petrescu', 'Kofi Asante', 'Sana Iqbal',
    'Tom Alderney', 'Elena Popov', 'Haruki Sato', 'Lila Marais',
    'Juno Park', 'Beatrice Hall',
  ];
  const topAuthors = [...authorPool].sort(() => rand() - 0.5).slice(0, 5).map((name) => ({
    name,
    flagged: int(rand, 3, 24),
  })).sort((a, b) => b.flagged - a.flagged);

  // Streak + baseline
  const streakDays = int(rand, 3, Math.min(90, Math.max(3, days)));
  const baselineAiPercent = 18;

  return {
    scope,
    range,
    totals: { scans, flagged, aiPercent, tokensUsed, tokensQuota },
    verdict: { human: humanCount, mixed: mixedCount, ai: aiCount },
    trend,
    byType,
    byPlatform,
    topSites,
    tokens,
    confidence,
    modelUsage,
    topAuthors,
    streakDays,
    baselineAiPercent,
  };
}

export const SCOPE_LABELS: Record<Scope, string> = {
  all: 'All',
  websites: 'Websites',
  social: 'Social media',
  facebook: 'Facebook',
  youtube: 'YouTube',
  instagram: 'Instagram',
};

export const RANGE_LABELS: Record<Range, string> = {
  today: 'Today',
  '7d': '7d',
  '30d': '30d',
  all: 'All time',
};

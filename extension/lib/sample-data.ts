import type { ContentItem, Site, ModelGroup, Breakdown } from './types';

export const CONTENT_ITEMS: ContentItem[] = [
  { id: 1, kind: 'text',  author: 'Mira Okafor',  snip: 'Leveraging synergistic frameworks, our team has achieved…',       verdict: 'ai',    score: 92, model: 'GPT-4o (est.)',       when: 'just now' },
  { id: 2, kind: 'image', author: 'Dan Petrescu', snip: 'Portrait · 1024×1024 · face artifacts detected',                  verdict: 'ai',    score: 87, model: 'SDXL / Midjourney',  when: '2m ago' },
  { id: 3, kind: 'video', author: 'Tom Alderney', snip: '00:42 clip · voice cloning markers · lip-sync drift',             verdict: 'mixed', score: 61, model: 'ElevenLabs (voice)', when: '4m ago' },
  { id: 4, kind: 'text',  author: 'Kofi Asante',  snip: "In today's rapidly evolving landscape, it is…",                   verdict: 'ai',    score: 78, model: 'Claude 3 (est.)',     when: '7m ago' },
  { id: 5, kind: 'text',  author: 'Sana Iqbal',   snip: 'spent the whole morning debugging a CSS grid issue…',             verdict: 'human', score: 4,  model: '—',                   when: '8m ago' },
  { id: 6, kind: 'audio', author: 'pod · ep 241', snip: 'Guest intro · 0:12 · synthesized speech prob high',               verdict: 'ai',    score: 74, model: 'Play.ht (est.)',      when: '14m ago' },
];

export const SITES: Site[] = [
  { host: 'streamline.app', enabled: true,  count: 128, ai: 47 },
  { host: 'news.example',   enabled: true,  count: 42,  ai: 9 },
  { host: 'videos.vid',     enabled: false, count: 0,   ai: 0 },
  { host: 'forum.talk',     enabled: true,  count: 17,  ai: 3 },
  { host: '*.substack.com', enabled: true,  count: 230, ai: 88 },
  { host: 'pod.fm',         enabled: true,  count: 12,  ai: 5 },
];

export const MODEL_GROUPS: ModelGroup[] = [
  { key: 'text', label: 'Text detection', icon: 'text', options: [
    { id: 'heynotai-text-v3', name: 'heynotai Text v3', friendlyName: 'Reliable text checker', spec: '92.4% acc · en,es,fr,de,ar +12', friendlySpec: 'Balanced and dependable · recommended', tag: 'default',   speed: 'fast' },
    { id: 'binoculars-7b',    name: 'Binoculars 7B',    friendlyName: 'Precise text checker',  spec: '90.1% acc · en only',            friendlySpec: 'Higher precision — English only',       tag: 'accurate',  speed: 'medium' },
    { id: 'ghost-detect',     name: 'GhostDetect',      friendlyName: 'Thorough text checker', spec: '88.7% acc · long-form tuned',    friendlySpec: 'Deeper analysis for longer text',       tag: 'long-form', speed: 'slow' },
  ]},
  { key: 'image', label: 'Image detection', icon: 'image', options: [
    { id: 'pixel-forensics', name: 'PixelForensics', friendlyName: 'Reliable image checker', spec: '93.2% acc · diffusion + GAN',  friendlySpec: 'Balanced and dependable · recommended', tag: 'default',    speed: 'fast' },
    { id: 'stega-hunter',    name: 'StegaHunter',    friendlyName: 'Precise image checker',  spec: '89.5% acc · watermark-aware', friendlySpec: 'Higher precision — catches watermarks', tag: 'watermarks', speed: 'medium' },
  ]},
  { key: 'audio', label: 'Audio detection', icon: 'audio', options: [
    { id: 'wave-scan',    name: 'WaveScan',     friendlyName: 'Reliable voice checker', spec: '91.0% acc · voice cloning',  friendlySpec: 'Balanced and dependable · recommended', tag: 'default',   speed: 'medium' },
    { id: 'spectra-lite', name: 'Spectra Lite', friendlyName: 'Quick voice checker',    spec: '87.3% acc · fast on-device', friendlySpec: 'Very fast — runs on your device',       tag: 'on-device', speed: 'fast' },
  ]},
  { key: 'video', label: 'Video detection', icon: 'video', options: [
    { id: 'frame-drift',  name: 'FrameDrift',   friendlyName: 'Reliable video checker', spec: '88.9% acc · lip-sync + temporal', friendlySpec: 'Balanced and dependable · recommended', tag: 'default',  speed: 'slow' },
    { id: 'deepcheck-hd', name: 'DeepCheck HD', friendlyName: 'Precise video checker',  spec: '91.5% acc · high-res frames',     friendlySpec: 'Higher precision — best for HD',        tag: 'accurate', speed: 'slow' },
  ]},
];

export const BREAKDOWN: Breakdown[] = [
  { kind: 'text',  label: 'Text',   flagged: 31, total: 78, spark: [2, 3, 5, 4, 7, 6, 8, 5, 9, 8, 11, 9] },
  { kind: 'image', label: 'Images', flagged: 12, total: 34, spark: [1, 1, 2, 2, 1, 3, 4, 3, 5, 4, 3, 5] },
  { kind: 'audio', label: 'Audio',  flagged: 2,  total: 9,  spark: [0, 0, 1, 0, 1, 1, 0, 2, 1, 1, 2, 1] },
  { kind: 'video', label: 'Video',  flagged: 2,  total: 7,  spark: [0, 0, 0, 1, 0, 1, 1, 0, 1, 2, 1, 2] },
];

export const WATCHING: { host: string; status: 'active' | 'paused'; count: number }[] = [
  { host: 'streamline.app', status: 'active', count: 128 },
  { host: 'news.example',   status: 'active', count: 42 },
  { host: 'videos.vid',     status: 'paused', count: 0 },
  { host: 'forum.talk',     status: 'active', count: 17 },
];

// Platform-specific content that populates the top card when the user
// is browsing a social platform (Home tab). Mock data only.
import type { Verdict, ContentKind } from './types';

export interface Hotspot {
  at: string;              // '0:12' or 'caption line 2'
  label: string;           // short description of what was detected
  confidence: number;      // 0-100
  verdict: Verdict;
  kind: ContentKind;
}

export interface Creator {
  displayName: string;
  handle: string;
  verified?: boolean;
  sub?: string;            // "128K subs" / "42K followers"
  scanned: number;         // pieces of content we've checked from them
  avgAi: number;           // 0-100
  flagged: number;
  lastChecked: string;     // "3h ago"
}

export interface PlatformContent {
  title: string;
  author: string;          // @handle or channel
  meta: string;            // duration, post type, timestamp
  kind: ContentKind;       // which icon to show
  score: number;
  verdict: Verdict;
  tagline: string;         // short verdict line, shown under the score
  signals: { label: string; value: string; hint?: string; verdict?: Verdict }[];
  hotspots: Hotspot[];     // timeline / per-element flags
  hotspotLabel: string;    // "Timeline of signals" / "Signal hotspots"
  timelineTotal?: string;  // video duration for a proportional track, optional
  creator: Creator;
  creatorCardTitle: string; // "Channel" / "Author" / "Account"
}

export const YOUTUBE_CONTENT: PlatformContent = {
  title: 'Why AI detection is broken (and how to fix it)',
  author: '@technotalks',
  meta: '12:04 · 14K views · 2d ago',
  kind: 'video',
  score: 68,
  verdict: 'ai',
  tagline: 'AI-synthesized voice and inconsistent frames',
  signals: [
    { label: 'Face analysis',     value: 'No deepfake',      hint: 'clean',     verdict: 'human' },
    { label: 'Voice cloning',     value: 'ElevenLabs-like',  hint: '84% conf',  verdict: 'ai'    },
    { label: 'Lip-sync drift',    value: '0.18s',            hint: 'mild',      verdict: 'mixed' },
    { label: 'Frame consistency', value: '2 cuts flagged',   hint: 'minor',     verdict: 'mixed' },
    { label: 'Scan time',         value: '1.8s' },
  ],
  hotspotLabel: 'Timeline of signals',
  timelineTotal: '12:04',
  hotspots: [
    { at: '0:12', label: 'AI-synthesized voice spike',  confidence: 88, verdict: 'ai',    kind: 'audio' },
    { at: '2:45', label: 'Frame inconsistency (cut)',   confidence: 62, verdict: 'mixed', kind: 'video' },
    { at: '5:18', label: 'Voice-print shift',           confidence: 74, verdict: 'ai',    kind: 'audio' },
    { at: '7:30', label: 'Lip-sync drift 0.18s',        confidence: 55, verdict: 'mixed', kind: 'video' },
    { at: '10:02', label: 'Generated B-roll footage',   confidence: 81, verdict: 'ai',    kind: 'video' },
  ],
  creatorCardTitle: 'Channel',
  creator: {
    displayName: 'TechnoTalks',
    handle: '@technotalks',
    verified: true,
    sub: '128K subs',
    scanned: 47,
    avgAi: 71,
    flagged: 29,
    lastChecked: '3h ago',
  },
};

export const FACEBOOK_CONTENT: PlatformContent = {
  title: 'Leveraging synergistic frameworks, our team has achieved…',
  author: 'Mira Okafor',
  meta: 'Post · public · 3h ago',
  kind: 'text',
  score: 92,
  verdict: 'ai',
  tagline: 'Text pattern strongly matches GPT-4o output',
  signals: [
    { label: 'Text AI score',    value: '92%',               hint: 'GPT-4o',   verdict: 'ai'    },
    { label: 'Images',           value: 'Clean',             hint: '0 flagged',verdict: 'human' },
    { label: 'Engagement',       value: 'Inorganic pattern', hint: 'unusual',  verdict: 'mixed' },
    { label: 'Comment AI rate',  value: '34%',               hint: '12 of 35' },
    { label: 'Scan time',        value: '0.9s' },
  ],
  hotspotLabel: 'Signal hotspots',
  hotspots: [
    { at: 'Paragraph 1', label: 'Template phrasing "leveraging synergies"', confidence: 94, verdict: 'ai',    kind: 'text' },
    { at: 'Paragraph 2', label: 'Boilerplate closing lines',                 confidence: 86, verdict: 'ai',    kind: 'text' },
    { at: 'Comment 3',   label: 'Reply also GPT-style',                      confidence: 72, verdict: 'ai',    kind: 'text' },
    { at: 'Comment 9',   label: 'Likely human reply',                        confidence: 14, verdict: 'human', kind: 'text' },
  ],
  creatorCardTitle: 'Author',
  creator: {
    displayName: 'Mira Okafor',
    handle: 'mira.okafor',
    sub: '2.4K friends',
    scanned: 18,
    avgAi: 64,
    flagged: 9,
    lastChecked: '1d ago',
  },
};

export const INSTAGRAM_CONTENT: PlatformContent = {
  title: 'sunset_studio · Reel',
  author: '@sunset_studio',
  meta: 'Reel · 0:34 · 8h ago',
  kind: 'image',
  score: 74,
  verdict: 'ai',
  tagline: 'Diffusion artifacts in frame · caption likely AI',
  signals: [
    { label: 'Image integrity',  value: 'GAN artifacts',    hint: 'faces',    verdict: 'ai'    },
    { label: 'Generation model', value: 'Midjourney-like',  hint: '87% conf', verdict: 'ai'    },
    { label: 'Caption AI score', value: '78%',              hint: 'Claude',   verdict: 'ai'    },
    { label: 'Face edits',       value: 'Filters · minor',  hint: 'light',    verdict: 'mixed' },
    { label: 'Scan time',        value: '1.1s' },
  ],
  hotspotLabel: 'Timeline of signals',
  timelineTotal: '0:34',
  hotspots: [
    { at: '0:04', label: 'Diffusion artifacts on face',   confidence: 87, verdict: 'ai',    kind: 'image' },
    { at: '0:12', label: 'Unnatural texture blending',    confidence: 79, verdict: 'ai',    kind: 'image' },
    { at: '0:20', label: 'Background geometry warps',     confidence: 66, verdict: 'mixed', kind: 'image' },
    { at: 'Caption', label: 'GPT-style caption phrasing', confidence: 78, verdict: 'ai',    kind: 'text'  },
  ],
  creatorCardTitle: 'Account',
  creator: {
    displayName: 'sunset studio',
    handle: '@sunset_studio',
    verified: false,
    sub: '42.1K followers',
    scanned: 31,
    avgAi: 69,
    flagged: 21,
    lastChecked: '6h ago',
  },
};

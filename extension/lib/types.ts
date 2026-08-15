export type Verdict = 'human' | 'ai' | 'mixed';
export type ContentKind = 'text' | 'image' | 'audio' | 'video';

// Trust states used by the YouTube content overlay (border + badge).
export type ScanState = 'authentic' | 'suspicious' | 'ai-generated';

export interface ScanDetection {
  state: ScanState;
  trustScore: number;
  label: string;
  sublabel: string;
  detectionType: string;
  faceAnalysis: string;
  audioSync: string;
  frameConsistency: string;
  scanTime: string;
}

export interface ScanEntry {
  videoId: string;
  title: string;
  result: ScanState;
  trustScore: number;
  timestamp: number;
  url: string;
  /** Backend `scans` record id for this verdict. Lets the drawer fetch
   *  the full record (detector name, confidence, timings) instead of
   *  rendering from the four summary fields above — `videoId` is the
   *  platform's media id on YouTube, so it can't be used for the
   *  lookup. */
  scanId?: string;
}

export interface ContentItem {
  id: number;
  kind: ContentKind;
  author: string;
  snip: string;
  verdict: Verdict;
  score: number;
  model: string;
  when: string;
}

export interface Site {
  host: string;
  enabled: boolean;
  /** Legacy per-site counters. Never populated from real scans — kept
   *  optional so previously-synced prefs still parse, but no surface
   *  renders them. */
  count?: number;
  ai?: number;
}

export interface ModelOption {
  id: string;
  name: string;              // technical name — shown in power mode
  friendlyName: string;      // user-friendly name — shown in normal mode
  spec: string;              // technical spec (accuracy %, details)
  friendlySpec: string;      // plain-language description
  tag: string;
  speed: 'fast' | 'medium' | 'slow';
}

export interface ModelGroup {
  key: ContentKind;
  label: string;
  icon: ContentKind;
  options: ModelOption[];
}

export interface Breakdown {
  kind: ContentKind;
  label: string;
  flagged: number;
  total: number;
  spark: number[];
}

export type Theme = 'light' | 'dark';

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
  count: number;
  ai: number;
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

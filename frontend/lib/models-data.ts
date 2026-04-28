/* ─────────────────────────────────────────────
   Detection-engine catalog backing /app/models.
   The page composes pure data — copy/numbers all
   live here so the UI files stay layout-only and
   the catalog can later be swapped for an API call
   without touching component code.
   ───────────────────────────────────────────── */

import type { ScanType } from "@/components/ui/TypeChip";

export type EngineType = Extract<ScanType, "txt" | "img" | "aud" | "vid">;

export type EngineBadge =
  | "default"
  | "recommended"
  | "fast"
  | "beta"
  | "byok"
  | "local"
  | "team"
  | "enterprise";

export type LockTier = "team" | "enterprise";

export type EngineCostUnit =
  | "/ scan"
  | "/ minute"
  | "via your API"
  | "runs locally";

export type Engine = {
  id: string;
  name: string;
  /** Optional italic suffix appended to the name (e.g. "v3"). */
  version?: string;
  badges: EngineBadge[];
  description: string;
  /** 0–100. */
  accuracy: number;
  /** Cost is rendered in mono; "free" shows in green, "high" in warn, otherwise neutral. */
  cost: { value: number; unit: EngineCostUnit; tone: "neutral" | "free" | "high" };
  locked?: { tier: LockTier; cta: "Upgrade" | "Contact sales" };
  byok?: { statusText: string };
};

export type TypeTab = {
  type: EngineType;
  label: string;
};

export const TYPE_TABS: TypeTab[] = [
  { type: "txt", label: "Text" },
  { type: "img", label: "Image" },
  { type: "aud", label: "Audio" },
  { type: "vid", label: "Video" },
];

export const ENGINES: Record<EngineType, Engine[]> = {
  txt: [
    {
      id: "atlas-pro",
      name: "Atlas Pro",
      version: "v3",
      badges: ["default", "recommended"],
      description:
        "Our flagship text detector. Trained on 40+ LLMs, updated weekly. Best balance of accuracy, speed, and cost. Detects GPT-5, Claude 4.5, Gemini 3, Llama 4, and more.",
      accuracy: 94,
      cost: { value: 2, unit: "/ scan", tone: "neutral" },
    },
    {
      id: "atlas-lite",
      name: "Atlas Lite",
      badges: ["fast"],
      description:
        "3× faster than Atlas Pro at the cost of ~5% accuracy. Best for high-volume batch scans where speed matters more than precision (essay grading, social monitors).",
      accuracy: 89,
      cost: { value: 1, unit: "/ scan", tone: "neutral" },
    },
    {
      id: "openai-classifier",
      name: "OpenAI Classifier",
      badges: ["byok"],
      description:
        "Use your own OpenAI API key for text classification. We charge nothing — you pay OpenAI directly at their rates. Fast and accurate, but limited to detecting GPT family.",
      accuracy: 88,
      cost: { value: 0, unit: "via your API", tone: "free" },
      byok: {
        statusText:
          "API key configured · sk-•••••••••••••••8a2f · last validated 4 days ago",
      },
    },
    {
      id: "atlas-local",
      name: "Atlas Local",
      badges: ["local", "beta"],
      description:
        "Run detection entirely on your device — no content ever leaves your computer. Slower and slightly less accurate, but ideal for confidential or regulated material.",
      accuracy: 86,
      cost: { value: 0, unit: "runs locally", tone: "free" },
    },
    {
      id: "atlas-forensics",
      name: "Atlas Forensics",
      badges: ["team"],
      description:
        "Heavyweight forensic-grade engine with paragraph-level attribution, model fingerprinting, and chain-of-custody export. Built for legal evidence and academic publication.",
      accuracy: 97,
      cost: { value: 8, unit: "/ scan", tone: "high" },
      locked: { tier: "team", cta: "Upgrade" },
    },
    {
      id: "atlas-adversarial",
      name: "Atlas Adversarial",
      badges: ["enterprise"],
      description:
        "Specialized engine trained against paraphrasing attacks, prompt injection laundering, and human-edited AI text. Used by major newsrooms and university integrity offices.",
      accuracy: 98,
      cost: { value: 14, unit: "/ scan", tone: "high" },
      locked: { tier: "enterprise", cta: "Contact sales" },
    },
  ],
  img: [
    {
      id: "pixel-forensics",
      name: "Pixel Forensics",
      version: "v2",
      badges: ["byok", "recommended"],
      description:
        "Detects diffusion-model artifacts, GAN signatures, and metadata inconsistencies. Configured with your Sightengine API key. Catches Midjourney, Stable Diffusion, FLUX, DALL-E.",
      accuracy: 93,
      cost: { value: 0, unit: "via your API", tone: "free" },
      byok: {
        statusText:
          "Sightengine key configured · 12,400 / 50,000 calls used this month",
      },
    },
    {
      id: "pixel-standard",
      name: "Pixel Standard",
      badges: ["default"],
      description:
        "Our managed image detection engine — no API key required. Slightly less accurate than Forensics on highly post-processed images.",
      accuracy: 90,
      cost: { value: 3, unit: "/ scan", tone: "neutral" },
    },
    {
      id: "pixel-provenance",
      name: "Pixel Provenance",
      badges: ["enterprise"],
      description:
        "C2PA-aware image forensics with provenance chain reconstruction. Detects edits, generations, and authentic camera-to-publish workflows.",
      accuracy: 96,
      cost: { value: 12, unit: "/ scan", tone: "high" },
      locked: { tier: "enterprise", cta: "Contact sales" },
    },
  ],
  aud: [
    {
      id: "vocal-print",
      name: "Vocal Print",
      version: "v2",
      badges: ["default"],
      description:
        "Detects voice cloning from ElevenLabs, Play.ht, Resemble, OpenAI Voice. Works on calls, voicemails, and music. Spectral analysis + speaker fingerprinting.",
      accuracy: 89,
      cost: { value: 5, unit: "/ scan", tone: "neutral" },
    },
    {
      id: "resemble-detect",
      name: "Resemble Detect",
      badges: ["byok"],
      description:
        "Use your own Resemble.ai detection key. Great for catching their own clones plus others, with very fast turnaround.",
      accuracy: 87,
      cost: { value: 0, unit: "via your API", tone: "free" },
    },
    {
      id: "vocal-forensics",
      name: "Vocal Forensics",
      badges: ["team"],
      description:
        "Court-grade voice authentication with speaker verification, anti-replay analysis, and comparison against known reference samples.",
      accuracy: 95,
      cost: { value: 11, unit: "/ scan", tone: "high" },
      locked: { tier: "team", cta: "Upgrade" },
    },
  ],
  vid: [
    {
      id: "framewatch-pro",
      name: "FrameWatch Pro",
      badges: ["default"],
      description:
        "Frame-level deepfake detection with face-swap, lip-sync, and Sora/Veo/Runway signature recognition. Token cost scales with video duration.",
      accuracy: 86,
      cost: { value: 15, unit: "/ minute", tone: "high" },
    },
    {
      id: "framewatch-lite",
      name: "FrameWatch Lite",
      badges: ["fast"],
      description:
        "Keyframe sampling instead of full-frame analysis. 4× faster, lower token cost. Best for screening large video batches before deeper review.",
      accuracy: 79,
      cost: { value: 4, unit: "/ minute", tone: "neutral" },
    },
    {
      id: "reality-defender",
      name: "Reality Defender",
      badges: ["team"],
      description:
        "Multi-model ensemble combining 5 deepfake detectors plus geometric analysis. The standard for newsroom-grade video verification.",
      accuracy: 94,
      cost: { value: 28, unit: "/ minute", tone: "high" },
      locked: { tier: "team", cta: "Upgrade" },
    },
    {
      id: "framewatch-forensics",
      name: "FrameWatch Forensics",
      badges: ["enterprise"],
      description:
        "Court-admissible video analysis with chain-of-custody, expert-witness reports, and per-frame attribution. Used by intelligence and law enforcement clients.",
      accuracy: 99,
      cost: { value: 60, unit: "/ minute", tone: "high" },
      locked: { tier: "enterprise", cta: "Contact sales" },
    },
  ],
};

/** Default selected engine per type — the one carrying the "default" or
 *  "recommended" badge in each list. */
export const DEFAULT_SELECTION: Record<EngineType, string> = {
  txt: "atlas-pro",
  img: "pixel-forensics",
  aud: "vocal-print",
  vid: "framewatch-pro",
};

export type TokenUsage = {
  used: number;
  total: number;
  resetsOn: string;
  avgPerDay: number;
  segments: { type: EngineType; value: number }[];
};

export const TOKEN_USAGE: TokenUsage = {
  used: 62_400,
  total: 100_000,
  resetsOn: "May 1",
  avgPerDay: 2_080,
  segments: [
    { type: "txt", value: 14_800 },
    { type: "img", value: 11_200 },
    { type: "aud", value: 5_600 },
    { type: "vid", value: 30_800 },
  ],
};

export const TYPE_LABEL: Record<EngineType, string> = {
  txt: "Text",
  img: "Image",
  aud: "Audio",
  vid: "Video",
};

export const BADGE_LABEL: Record<EngineBadge, string> = {
  default: "DEFAULT",
  recommended: "RECOMMENDED",
  fast: "FAST",
  beta: "BETA",
  byok: "BYOK",
  local: "ON-DEVICE",
  team: "TEAM PLAN",
  enterprise: "ENTERPRISE",
};

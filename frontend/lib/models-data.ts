/* ─────────────────────────────────────────────
   Detection-engine catalog backing /app/models.

   /app/models now fetches engines + defaults from
   the API (`GET /models`, `GET /models/defaults`),
   so the constants here are a fallback used only
   by the editor clients (TextEditorClient et al.)
   when offline or pre-hydration. They mirror the
   seed in `pocketbase/seed-models.sh` so the two
   surfaces don't diverge.
   ───────────────────────────────────────────── */

import type { ScanType } from "@/components/ui/TypeChip";
import type { Plan } from "@heynotai/shared";

export type EngineType = Extract<ScanType, "txt" | "img" | "aud" | "vid">;

export type EngineBadge =
  | "default"
  | "recommended"
  | "fast"
  | "beta"
  | "local"
  | "team"
  | "enterprise";

export type EngineCostUnit =
  | "/ scan"
  | "/ minute"
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
  /** Cost is rendered in mono; "high" in warn, otherwise neutral. */
  cost: { value: number; unit: EngineCostUnit; tone: "neutral" | "free" | "high" };
  /** Plan tier required to use this engine. Models above the user's
   *  plan render with a per-tier border + Upgrade CTA. */
  tier: Plan;
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

/** Fallback catalog. Mirrors seed-models.sh — keep in sync if you
 *  add/remove models there. /app/models reads the live list from
 *  `/models`; this is what shows up if that fetch hasn't resolved.
 *  Ordered cheapest-first within each type to match the API sort. */
export const ENGINES: Record<EngineType, Engine[]> = {
  txt: [
    {
      id: "fakespot-roberta",
      name: "Fakespot AI Detector",
      badges: ["default", "recommended"],
      description:
        "RoBERTa-based detector trained on a broad mix of human and AI text. Solid general-purpose pick.",
      accuracy: 91,
      cost: { value: 1, unit: "/ scan", tone: "neutral" },
      tier: "check",
    },
    {
      id: "simpleai-chatgpt",
      name: "SimpleAI ChatGPT Detector",
      badges: ["fast"],
      description:
        "Tuned specifically against ChatGPT outputs. High recall on GPT-family text.",
      accuracy: 89,
      cost: { value: 2, unit: "/ scan", tone: "neutral" },
      tier: "verify",
    },
    {
      id: "openai-roberta",
      name: "OpenAI RoBERTa Detector",
      badges: [],
      description:
        "OpenAI's classic RoBERTa-based GPT-2 detector. Useful as a baseline; weaker on newer LLMs.",
      accuracy: 84,
      cost: { value: 4, unit: "/ scan", tone: "neutral" },
      tier: "certify",
    },
  ],
  img: [
    {
      id: "deepfake-v2",
      name: "Deep-Fake Detector v2",
      badges: ["default", "recommended"],
      description:
        "ViT-based deepfake detector. Reports ~92% accuracy on standard benchmarks.",
      accuracy: 92,
      cost: { value: 2, unit: "/ scan", tone: "neutral" },
      tier: "check",
    },
    {
      id: "siglip2-deepfake",
      name: "Deepfake Detect SigLIP2",
      badges: ["beta"],
      description:
        "SigLIP2-backbone deepfake detector. Newer architecture, strong on stylized AI imagery.",
      accuracy: 94,
      cost: { value: 4, unit: "/ scan", tone: "neutral" },
      tier: "verify",
    },
    {
      id: "vit-deepfake",
      name: "ViT Deepfake Detection",
      badges: [],
      description:
        "Vision Transformer fine-tuned for deepfake detection. Reports 98.7% on its evaluation set.",
      accuracy: 98,
      cost: { value: 8, unit: "/ scan", tone: "high" },
      tier: "certify",
    },
  ],
  aud: [
    {
      id: "modulate-velma",
      name: "Modulate Velma Deepfake",
      badges: ["recommended"],
      description:
        "Modulate Velma Deepfake Detect — #1 on the HF Speech Deepfake Arena. Per-segment probability scores collapsed to a single verdict.",
      accuracy: 99,
      cost: { value: 12, unit: "/ scan", tone: "high" },
      tier: "verify",
    },
  ],
  vid: [
    {
      id: "frames-deepfake-v2",
      name: "Frame-by-frame Deep-Fake v2",
      badges: ["recommended"],
      description:
        "Samples 16 evenly-spaced frames and runs Deep-Fake Detector v2 on each, then aggregates.",
      accuracy: 88,
      cost: { value: 8, unit: "/ minute", tone: "high" },
      tier: "verify",
    },
    {
      id: "frames-vit-deepfake",
      name: "Frame-by-frame ViT Deepfake",
      badges: [],
      description:
        "Samples 16 frames and runs the ViT_Deepfake_Detection image model on each, then aggregates.",
      accuracy: 92,
      cost: { value: 12, unit: "/ minute", tone: "high" },
      tier: "team",
    },
  ],
};

/** Default selected engine per type — used by the editor clients
 *  (TextEditorClient et al.) when a scan record has no `engineId`
 *  (legacy rows pre-create-endpoint). Points at the cheapest model
 *  per modality regardless of tier; the API enforces tier guards on
 *  the actual scan path. */
export const DEFAULT_SELECTION: Record<EngineType, string> = {
  txt: "fakespot-roberta",
  img: "deepfake-v2",
  aud: "modulate-velma",
  vid: "frames-deepfake-v2",
};

/** Real per-user usage now comes from `GET /me/usage`. Kept here for
 *  type compatibility with `<TokenUsageBand>`. */
export type TokenUsage = {
  used: number;
  total: number | null;
  resetsOn: string;
  avgPerDay: number;
  segments: { type: EngineType; value: number }[];
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
  local: "ON-DEVICE",
  team: "TEAM PLAN",
  enterprise: "ENTERPRISE",
};

/** Per-tier label shown in the small pill on each engine row. The
 *  free tier (`check`) is omitted — its rows render plain. */
export const TIER_LABEL: Record<Plan, string> = {
  check: "FREE",
  verify: "VERIFY",
  certify: "CERTIFY",
  team: "TEAM",
};

/**
 * Mock changelog feed for /app/updates. Replace with a real backend
 * fetch when the changelog API lands. The shape is deliberately a
 * superset — every variant slot (modelPreview / accuracyCompare /
 * statBand) is optional so the same `UpdateCard` renders all kinds.
 */

export type UpdateKind = "new-model" | "accuracy" | "product" | "fix";
export type UpdateContentType = "txt" | "img" | "vid" | "aud";
export type DayGroup = "this-week" | "last-week" | "earlier-april";

export type ModelPreview = {
  /** Vendor key — drives the logo tile background via `data-vendor`. */
  vendor: "openai" | "google" | "flux" | "anthropic" | "eleven";
  initials: string;
  name: string;
  /** "OpenAI · TEXT · trained Apr 19" */
  metaLine: string;
  accuracy: number;
  /** When true, the accuracy figure is rendered in the warn tone — used
   *  for beta models that haven't crossed the support threshold. */
  warn?: boolean;
};

export type AccuracyCompare = {
  beforeLabel: string;
  before: number;
  afterLabel: string;
  after: number;
};

export type StatBandItem = {
  label: string;
  value: string;
  /** Optional verb tone applied to the value text. */
  tone?: "up" | "down";
};

export interface UpdateItem {
  id: string;
  kind: UpdateKind;
  contentType?: UpdateContentType;
  dayGroup: DayGroup;
  /** Short relative + absolute label, e.g. "2 days ago · Apr 22". */
  timestamp: string;
  /** Title may include literal `<em>…</em>` markup; rendered with
   *  dangerouslySetInnerHTML on the title node only. The italic-em
   *  pattern is reset to non-italic full-fg via CSS — same convention
   *  as the home greeting. */
  title: string;
  /** Description may include `<strong>` and `<em>` for emphasis. */
  description: string;
  meta?: string;
  cta?: { label: string; href?: string };
  unread?: boolean;
  modelPreview?: ModelPreview;
  accuracyCompare?: AccuracyCompare;
  statBand?: StatBandItem[];
}

export const KIND_LABEL: Record<UpdateKind, string> = {
  "new-model": "New model",
  accuracy: "Accuracy",
  product: "Product",
  fix: "Fix",
};

export const KIND_TAG_LABEL: Record<UpdateKind, string> = {
  "new-model": "NEW MODEL",
  accuracy: "ACCURACY",
  product: "PRODUCT",
  fix: "FIX",
};

export const CONTENT_TYPE_LABEL: Record<UpdateContentType, string> = {
  txt: "TEXT",
  img: "IMAGE",
  vid: "VIDEO",
  aud: "AUDIO",
};

export const DAY_GROUP_LABEL: Record<
  DayGroup,
  { lead: string; em: string; range: string }
> = {
  "this-week": { lead: "This", em: "week", range: "Apr 22 — Apr 24" },
  "last-week": { lead: "Last", em: "week", range: "Apr 15 — Apr 21" },
  "earlier-april": {
    lead: "Earlier in",
    em: "April",
    range: "Apr 1 — Apr 14",
  },
};

export const DAY_GROUP_ORDER: DayGroup[] = [
  "this-week",
  "last-week",
  "earlier-april",
];

export const UPDATES: UpdateItem[] = [
  {
    id: "u-gpt5-turbo",
    kind: "new-model",
    contentType: "txt",
    dayGroup: "this-week",
    timestamp: "2 days ago · Apr 22",
    title: "GPT-5 <em>turbo</em> detection shipped",
    description:
      "OpenAI released GPT-5 turbo last week. We've trained our text detector on <strong>14,000 sample outputs</strong> and shipped support today. Detection is auto-enabled on all accounts — your existing scans can be re-run for free.",
    meta: "<strong>21</strong> matches in your scans · 30d",
    cta: { label: "Re-scan with new model", href: "/app/library" },
    unread: true,
    modelPreview: {
      vendor: "openai",
      initials: "G5",
      name: "GPT-5 turbo",
      metaLine: "OpenAI · TEXT · trained Apr 19",
      accuracy: 94,
    },
  },
  {
    id: "u-pixel-forensics",
    kind: "accuracy",
    contentType: "img",
    dayGroup: "this-week",
    timestamp: "2 days ago · Apr 22",
    title: "Pixel Forensics — <em>Midjourney v7 detection improved</em>",
    description:
      "After analyzing <strong>40,000 newly tagged samples</strong>, we re-trained Pixel Forensics on Midjourney v7 outputs. False-positive rate dropped from <strong>7.2%</strong> to <strong>2.8%</strong>, and overall accuracy rose 4 points.",
    meta: "Affects <strong>Pixel Forensics v2</strong> · auto-applied",
    cta: { label: "View benchmark", href: "/app/models" },
    unread: true,
    accuracyCompare: {
      beforeLabel: "Before",
      before: 89,
      afterLabel: "After",
      after: 93,
    },
  },
  {
    id: "u-bulk-rescan",
    kind: "product",
    dayGroup: "this-week",
    timestamp: "3 days ago · Apr 21",
    title: "Bulk re-scan from <em>any collection</em>",
    description:
      "You can now re-scan an entire collection with your current engine selection. Useful when you switch from <em>Atlas Lite</em> to <em>Atlas Pro</em> and want to re-verify earlier work, or after we ship a new model.",
    meta: "Available on all plans",
    cta: { label: "Open Collections", href: "/app/collections" },
    unread: true,
    statBand: [
      { label: "Re-scan", value: "1-click" },
      { label: "Tokens", value: "Pooled" },
      { label: "For new models", value: "Free", tone: "up" },
    ],
  },
  {
    id: "u-veo-3",
    kind: "new-model",
    contentType: "vid",
    dayGroup: "last-week",
    timestamp: "5 days ago · Apr 19",
    title: "Veo 3 detection — <em>still in beta</em>",
    description:
      "Google released Veo 3 last month. We're catching about <strong>82%</strong> of outputs, which is below our 87% threshold for full support — but we know users need it now, so it's available as <em>beta</em>. Expect false negatives on shorter clips.",
    meta: "Off by default · enable in <strong>Models</strong>",
    cta: { label: "Read methodology", href: "/app/models" },
    modelPreview: {
      vendor: "google",
      initials: "V3",
      name: "Veo 3",
      metaLine: "Google DeepMind · VIDEO · beta",
      accuracy: 82,
      warn: true,
    },
  },
  {
    id: "u-telegram-monitors",
    kind: "product",
    dayGroup: "last-week",
    timestamp: "6 days ago · Apr 18",
    title: "Telegram channel monitors",
    description:
      "You can now set up monitors on public Telegram channels. Same alerting rules, same dashboard. <strong>Pro and Team plans only.</strong>",
    meta: "New monitor type · 6 templates updated",
    cta: { label: "Create monitor", href: "/app/monitors" },
  },
  {
    id: "u-flux-1-2-pro",
    kind: "new-model",
    contentType: "img",
    dayGroup: "last-week",
    timestamp: "1 week ago · Apr 17",
    title: "FLUX <em>1.2 pro</em> support",
    description:
      "Black Forest Labs shipped FLUX 1.2 pro on April 12. We added detection three days later. Auto-enabled.",
    meta: "Auto-enabled · 0 matches in your scans yet",
    cta: { label: "View in Models", href: "/app/models" },
    modelPreview: {
      vendor: "flux",
      initials: "F2",
      name: "FLUX 1.2 pro",
      metaLine: "Black Forest Labs · IMAGE",
      accuracy: 90,
    },
  },
  {
    id: "u-reddit-fix",
    kind: "fix",
    dayGroup: "last-week",
    timestamp: "1 week ago · Apr 17",
    title: "Extension stopped scanning long Reddit threads",
    description:
      "The Chrome extension was timing out on Reddit threads with more than 200 comments. Fixed — the extension now chunks long pages and reports per-thread verdicts instead of failing silently.",
    meta: "Extension v2.4.1 · auto-updated",
  },
  {
    id: "u-vocal-print-v2",
    kind: "accuracy",
    contentType: "aud",
    dayGroup: "earlier-april",
    timestamp: "2 weeks ago · Apr 11",
    title: "Vocal Print <em>v2</em> released",
    description:
      "A full rewrite of our voice-cloning detector. Better at catching ElevenLabs v3, Play.ht 3.0, and Resemble's latest. Spectral fingerprinting now runs on shorter clips (down to <strong>3 seconds</strong>, was <strong>10s</strong>).",
    meta: "Auto-applied to all audio scans",
    cta: { label: "View detector page", href: "/app/models" },
    accuracyCompare: {
      beforeLabel: "v1",
      before: 81,
      afterLabel: "v2",
      after: 89,
    },
  },
  {
    id: "u-byok-sightengine",
    kind: "product",
    dayGroup: "earlier-april",
    timestamp: "3 weeks ago · Apr 4",
    title: "BYOK for image detection — <em>Sightengine integration</em>",
    description:
      "Bring your own Sightengine API key for image scans. We charge zero tokens — you pay Sightengine directly at their rates. Useful if you already have an enterprise contract or want absolute cost control.",
    meta: "Engines page · Image section",
    cta: { label: "Configure", href: "/app/models" },
  },
];

export const UNREAD_INITIAL = UPDATES.filter((u) => u.unread).map((u) => u.id);

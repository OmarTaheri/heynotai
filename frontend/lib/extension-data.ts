/* Extension page fixtures + types. Mirrors lib/settings-data.ts:
   types beside hand-curated mock rows so the page renders without
   a backend. Replace with live data once the extension manifest +
   per-site rule endpoints land. */

import type { IconName } from "@/components/Icon";
import type { PillTone } from "@/components/ui/Pill";

export type BrowserId = "chrome" | "firefox" | "edge" | "safari";

export type BrowserSupport = {
  id: BrowserId;
  name: string;
  status: "installed" | "available" | "soon";
  version?: string;
  /** Letter shown in the colored logo tile. */
  initial: string;
  /** Hue used by the logo tile gradient. Matches each browser's brand. */
  hue: "chrome" | "firefox" | "edge" | "safari";
};

export const EXTENSION_META = {
  browser: "Chrome",
  version: "2.4.1",
  installedAt: "Aug 14, 2025",
  lastSyncedSeconds: 12,
  scansLast7Days: 298,
  autoUpdates: true,
  storeUrl: "https://chrome.google.com/webstore",
};

export const BROWSERS: BrowserSupport[] = [
  { id: "chrome", name: "Chrome", status: "installed", version: "v2.4.1", initial: "C", hue: "chrome" },
  { id: "firefox", name: "Firefox", status: "available", initial: "F", hue: "firefox" },
  { id: "edge", name: "Edge", status: "available", initial: "e", hue: "edge" },
  { id: "safari", name: "Safari", status: "soon", initial: "S", hue: "safari" },
];

/* ── Toggle settings (scan behavior, alerts, advanced) ───────── */

export type ToggleTag = { tone: PillTone; label: string };

export type ToggleSetting = {
  id: string;
  name: string;
  description: string;
  defaultOn: boolean;
  tag?: ToggleTag;
  /** When set, the toggle renders as locked + disabled. */
  locked?: { reason: string; tag: ToggleTag };
};

export const SCAN_BEHAVIORS: ToggleSetting[] = [
  {
    id: "right-click",
    name: "Right-click to scan",
    description:
      'Adds a "Scan with Detect" option to your right-click menu on text selections, images, and videos. Most privacy-respecting mode.',
    defaultOn: true,
    tag: { tone: "info", label: "RECOMMENDED" },
  },
  {
    id: "auto-scan",
    name: "Auto-scan trusted sites",
    description:
      "Silently scan content on sites you've allowlisted (set up below). Verdicts appear inline; nothing is stored unless you save it. Currently allowlisted on 4 sites.",
    defaultOn: true,
    tag: { tone: "human", label: "YOU CONTROL" },
  },
  {
    id: "scan-on-hover",
    name: "Scan on hover (1s delay)",
    description:
      "When you hover over an image or paragraph for more than one second on an allowlisted site, run a quick scan. Off by default — most users prefer click-to-scan.",
    defaultOn: false,
  },
  {
    id: "inline-overlay",
    name: "Inline verdict overlays",
    description:
      "When auto-scan flags something as AI, show a small badge inline (next to the image or paragraph). Otherwise verdicts only appear in the extension popup.",
    defaultOn: true,
  },
  {
    id: "show-authentic",
    name: "Show authentic verdicts too",
    description:
      "By default, only AI-flagged content gets a badge. Enable this to also see green checkmarks on content the scanner verified as authentic. More visual noise, but more reassuring.",
    defaultOn: false,
  },
];

export const ALERT_SETTINGS: ToggleSetting[] = [
  {
    id: "browser-notifs",
    name: "Browser notifications when AI is detected",
    description:
      "A native OS notification when the extension flags content. Otherwise alerts only appear in the extension popup.",
    defaultOn: true,
  },
  {
    id: "sound",
    name: "Sound on flag",
    description:
      "Play a soft chime when content is flagged. Helpful when you have auto-scan running while reading; off by default to keep things quiet.",
    defaultOn: false,
  },
  {
    id: "badge-counter",
    name: "Badge counter on the toolbar icon",
    description:
      "Show the number of AI-flagged items found on your current page, right on the extension icon. Resets when you change tabs.",
    defaultOn: true,
  },
];

export const ADVANCED_SETTINGS: ToggleSetting[] = [
  {
    id: "on-device",
    name: "On-device pre-filter",
    description:
      "Run a tiny classifier locally before sending anything to our servers. Filters out obvious authentic content so cloud scans only happen when needed. Reduces token usage by ~30%.",
    defaultOn: false,
    tag: { tone: "neutral", label: "BETA" },
  },
  {
    id: "sync",
    name: "Sync settings across devices",
    description:
      "Keep your per-site rules, hotkeys, and alert preferences synced across every browser you sign in to. Currently locked to this device only on your plan.",
    defaultOn: false,
    locked: {
      reason: "Available on Team plan",
      tag: { tone: "gold", label: "TEAM PLAN" },
    },
  },
  {
    id: "anon-stats",
    name: "Send anonymous usage stats",
    description:
      "Help us improve by sending error logs and performance data. Never includes page content, URLs, or what you scanned.",
    defaultOn: true,
  },
  {
    id: "debug",
    name: "Show debug overlay",
    description:
      "Display engine name, latency, and confidence breakdown next to every scan. Useful for testing detection across sites; otherwise distracting.",
    defaultOn: false,
  },
];

/* ── Per-site rules ──────────────────────────────────────────── */

export type SiteMode = "auto" | "click" | "off";
export type ContentType = "txt" | "img" | "aud" | "vid";

export type SiteRule = {
  domain: string;
  /** Letter mark shown in the favicon tile. */
  initial: string;
  /** Token from SiteFavicon's brand map (x, yt, ig, rd, bbc, li, …). */
  brand: string;
  scans7d: number;
  flagged7d: number;
  mode: SiteMode;
  /** Active content types — ordered TXT, IMG, AUD, VID. */
  types: ContentType[];
  /** Greyed-out content types shown after the active ones for context. */
  typesOff: ContentType[];
  /** Replaces the scans/flagged stats line when present. */
  customStats?: string;
};

export const SITE_RULES: SiteRule[] = [
  {
    domain: "x.com / twitter.com",
    initial: "𝕏",
    brand: "x",
    scans7d: 147,
    flagged7d: 12,
    mode: "auto",
    types: ["txt", "img", "vid"],
    typesOff: [],
  },
  {
    domain: "youtube.com",
    initial: "▶",
    brand: "yt",
    scans7d: 32,
    flagged7d: 4,
    mode: "click",
    types: ["vid", "aud"],
    typesOff: ["txt"],
  },
  {
    domain: "instagram.com",
    initial: "IG",
    brand: "ig",
    scans7d: 89,
    flagged7d: 22,
    mode: "auto",
    types: ["img", "vid"],
    typesOff: ["txt"],
  },
  {
    domain: "bbc.com / bbc.co.uk",
    initial: "B",
    brand: "bbc",
    scans7d: 18,
    flagged7d: 0,
    mode: "auto",
    types: ["txt", "img"],
    typesOff: [],
  },
  {
    domain: "reddit.com",
    initial: "r/",
    brand: "rd",
    scans7d: 12,
    flagged7d: 3,
    mode: "click",
    types: ["txt", "img"],
    typesOff: ["vid"],
  },
  {
    domain: "linkedin.com",
    initial: "in",
    brand: "li",
    scans7d: 0,
    flagged7d: 0,
    mode: "off",
    types: [],
    typesOff: ["txt", "img"],
    customStats: "0 scans · 7 days · paused by you",
  },
];

/* ── Hotkeys ─────────────────────────────────────────────────── */

export type Hotkey = {
  id: string;
  label: string;
  /** Pre-split key tokens — rendered with KeycapHint with `+` between. */
  keys: string[];
};

export const HOTKEYS: Hotkey[] = [
  { id: "open-popup", label: "Open extension popup", keys: ["⌘", "Shift", "D"] },
  { id: "scan-text", label: "Scan selected text", keys: ["⌘", "Shift", "S"] },
  { id: "scan-page", label: "Scan full page", keys: ["⌘", "Shift", "P"] },
  { id: "toggle-auto", label: "Toggle auto-scan on this site", keys: ["⌘", "Shift", "A"] },
];

/* ── Confidence threshold options ────────────────────────────── */

export type ConfidenceOption = "≥ 50%" | "≥ 75%" | "≥ 90%";
export const CONFIDENCE_OPTIONS: ConfidenceOption[] = ["≥ 50%", "≥ 75%", "≥ 90%"];

/* ── Default-mode segmented control ──────────────────────────── */

export const SITE_MODE_OPTIONS: { id: SiteMode; label: string; icon: IconName }[] = [
  { id: "off", label: "Off", icon: "x" },
  { id: "click", label: "Click only", icon: "check" },
  { id: "auto", label: "Auto-scan", icon: "globe" },
];

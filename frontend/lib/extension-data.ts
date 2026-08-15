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

export const EXTENSION_STORE_URL = "https://chrome.google.com/webstore";

/** Which browsers a build exists for. Install *state* is not encoded
 *  here — it's detected at runtime via `useExtensionPresence`, because
 *  only the running browser can answer that. This list used to claim
 *  "Chrome · Installed · v2.4.1" unconditionally. */
export const BROWSERS: BrowserSupport[] = [
  { id: "chrome", name: "Chrome", status: "available", initial: "C", hue: "chrome" },
  { id: "edge", name: "Edge", status: "available", initial: "e", hue: "edge" },
  { id: "firefox", name: "Firefox", status: "soon", initial: "F", hue: "firefox" },
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

/* Every toggle below maps to an id in `EXTENSION_FLAG_IDS`, which is
   the set the browser extension actually reads. Toggles that only
   persisted a boolean — "Scan on hover", "On-device pre-filter",
   "Send anonymous usage stats", desktop notifications and the flag
   chime — were removed rather than left looking functional. */

export const SCAN_BEHAVIORS: ToggleSetting[] = [
  {
    id: "right-click",
    name: "Right-click to scan",
    description:
      'Adds "Check this…" entries to your right-click menu on videos, posts, and text selections. Turning this off removes them from the menu.',
    defaultOn: true,
    tag: { tone: "info", label: "RECOMMENDED" },
  },
  {
    id: "inline-overlay",
    name: "Inline verdict overlays",
    description:
      "Draw the verdict border and badge directly on the media being checked. With this off, scans still run — the result only appears in the extension drawer.",
    defaultOn: true,
  },
  {
    id: "show-authentic",
    name: "Show authentic verdicts too",
    description:
      "By default the overlay fades out a few seconds after a human verdict, so clean pages stay undecorated. Enable this to keep it on screen.",
    defaultOn: false,
  },
];

export const ALERT_SETTINGS: ToggleSetting[] = [
  {
    id: "badge-counter",
    name: "Verdict badge on the toolbar icon",
    description:
      "Mark the extension icon with the verdict for the current tab — a tick, a tilde, or an exclamation mark — and animate it while a scan is running.",
    defaultOn: true,
  },
];

export const ADVANCED_SETTINGS: ToggleSetting[] = [
  {
    id: "debug",
    name: "Verbose scan logging",
    description:
      "Print the extension's scan decisions to the browser console — which page it classified, why it did or didn't auto-scan, and every message it exchanged. Useful when reporting a bug.",
    defaultOn: false,
    tag: { tone: "neutral", label: "DIAGNOSTIC" },
  },
  {
    id: "sync",
    name: "Sync settings across devices",
    description:
      "Keep your per-site rules and preferences synced across every browser you sign in to.",
    defaultOn: false,
    locked: {
      reason: "Available on Team plan",
      tag: { tone: "gold", label: "TEAM PLAN" },
    },
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
  mode: SiteMode;
  /** Active content types — ordered TXT, IMG, AUD, VID. */
  types: ContentType[];
  /** Greyed-out content types shown after the active ones for context. */
  typesOff: ContentType[];
  /** Replaces the default mode-description sub-line when present. */
  customStats?: string;
};

/* ── Hotkeys ─────────────────────────────────────────────────── */

export type Hotkey = {
  id: string;
  label: string;
  /** Pre-split key tokens — rendered with KeycapHint with `+` between. */
  keys: string[];
};

/** Mirrors the `commands` block in the extension manifest. Only list
 *  shortcuts that are actually registered — the previous four included
 *  "Scan selected text" and "Toggle auto-scan on this site", neither of
 *  which was bound to anything. */
export const HOTKEYS: Hotkey[] = [
  { id: "open-drawer", label: "Open the heynotai drawer", keys: ["Ctrl", "Shift", "D"] },
  { id: "scan-page", label: "Check the current page", keys: ["Ctrl", "Shift", "S"] },
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

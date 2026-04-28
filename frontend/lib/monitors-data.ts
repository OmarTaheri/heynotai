/* Monitors page fixtures + types. Mirrors frontend/lib/library-data.ts —
   types live alongside hand-curated mock rows so the page can render
   server-side without an API yet. */

export type MonitorKind =
  | "youtube"
  | "x"
  | "rss"
  | "folder"
  | "url"
  | "telegram";

export type MonitorStatus = "alert" | "healthy" | "warn" | "paused";

export type SparkBar = { height: number; flagged?: boolean };

export type Monitor = {
  id: string;
  kind: MonitorKind;
  name: string;
  /** Compact uppercase chip text shown next to the name. */
  typeLabel: string;
  /** Mono target/meta line under the name. */
  target: string;
  status: MonitorStatus;
  statusLabel: string;
  scanned: { value: string; sub: string };
  flagged: { value: string; sub: string };
  lastCheck: { value: string; sub: string };
  alertWhen: { value: string; sub: string };
  spark: SparkBar[];
};

export type MonitorAlert = {
  id: string;
  title: string;
  source: string;
  meta: string;
  verdictLabel: string;
  when: string;
};

export type MonitorTemplate = {
  id: string;
  kind: MonitorKind;
  name: string;
  desc: string;
};

export const MONITORS: Monitor[] = [
  {
    id: "m1",
    kind: "youtube",
    name: "@TechAuthority videos",
    typeLabel: "YouTube",
    target: "youtube.com/@TechAuthority · checking new uploads every 30m",
    status: "alert",
    statusLabel: "1 alert",
    scanned: { value: "147", sub: "last 7 days" },
    flagged: { value: "9", sub: "6.1% rate" },
    lastCheck: { value: "12m ago", sub: "next in 18m" },
    alertWhen: { value: "Conf ≥ 75%", sub: "email + push" },
    spark: [
      { height: 30 },
      { height: 55 },
      { height: 40 },
      { height: 75, flagged: true },
      { height: 25 },
      { height: 80, flagged: true },
      { height: 50 },
      { height: 35 },
      { height: 60 },
      { height: 90, flagged: true },
      { height: 45 },
      { height: 55 },
      { height: 70, flagged: true },
      { height: 40 },
    ],
  },
  {
    id: "m2",
    kind: "x",
    name: "@brand.handle posts",
    typeLabel: "X / Twitter",
    target: "x.com/brand.handle · text + media · realtime",
    status: "alert",
    statusLabel: "1 alert",
    scanned: { value: "432", sub: "last 7 days" },
    flagged: { value: "28", sub: "6.5% rate" },
    lastCheck: { value: "live", sub: "streaming" },
    alertWhen: { value: "Any AI", sub: "slack + email" },
    spark: [
      { height: 55 },
      { height: 65, flagged: true },
      { height: 40 },
      { height: 70 },
      { height: 85, flagged: true },
      { height: 50 },
      { height: 75, flagged: true },
      { height: 45 },
      { height: 60 },
      { height: 95, flagged: true },
      { height: 55 },
      { height: 80, flagged: true },
      { height: 65 },
      { height: 88, flagged: true },
    ],
  },
  {
    id: "m3",
    kind: "folder",
    name: "Voicemail drops folder",
    typeLabel: "Folder",
    target: "~/Recordings/voicemail · auto-scan new audio files · daily",
    status: "alert",
    statusLabel: "1 alert",
    scanned: { value: "31", sub: "last 7 days" },
    flagged: { value: "4", sub: "12.9% rate" },
    lastCheck: { value: "3h ago", sub: "next 21h" },
    alertWhen: { value: "Voice clone", sub: "push only" },
    spark: [
      { height: 20 },
      { height: 30 },
      { height: 25 },
      { height: 60, flagged: true },
      { height: 35 },
      { height: 20 },
      { height: 40 },
      { height: 30 },
      { height: 55, flagged: true },
      { height: 25 },
      { height: 30 },
      { height: 70, flagged: true },
      { height: 35 },
      { height: 50, flagged: true },
    ],
  },
  {
    id: "m4",
    kind: "rss",
    name: "Tech blog network feed",
    typeLabel: "RSS",
    target: "14 feeds · TechCrunch, The Verge, Wired, Ars Technica + 10 more",
    status: "healthy",
    statusLabel: "Healthy",
    scanned: { value: "298", sub: "last 7 days" },
    flagged: { value: "19", sub: "6.4% rate" },
    lastCheck: { value: "42m ago", sub: "hourly" },
    alertWhen: { value: "Conf ≥ 90%", sub: "slack only" },
    spark: [
      { height: 60 },
      { height: 70 },
      { height: 55 },
      { height: 65 },
      { height: 80, flagged: true },
      { height: 50 },
      { height: 60 },
      { height: 75 },
      { height: 45 },
      { height: 85, flagged: true },
      { height: 65 },
      { height: 55 },
      { height: 70 },
      { height: 60 },
    ],
  },
  {
    id: "m5",
    kind: "url",
    name: "Competitor landing page",
    typeLabel: "URL watch",
    target:
      "competitor.com/products · checking for AI copy + image changes · daily",
    status: "healthy",
    statusLabel: "Healthy",
    scanned: { value: "7", sub: "checks this week" },
    flagged: { value: "2", sub: "copy changes" },
    lastCheck: { value: "6h ago", sub: "next 18h" },
    alertWhen: { value: "Any change", sub: "email" },
    spark: [
      { height: 25 },
      { height: 25 },
      { height: 55, flagged: true },
      { height: 25 },
      { height: 25 },
      { height: 25 },
      { height: 25 },
      { height: 50, flagged: true },
      { height: 25 },
      { height: 25 },
      { height: 25 },
      { height: 25 },
      { height: 25 },
      { height: 25 },
    ],
  },
  {
    id: "m6",
    kind: "telegram",
    name: "Telegram channel: news_alerts",
    typeLabel: "Telegram",
    target: "t.me/news_alerts · paused while traveling",
    status: "paused",
    statusLabel: "Paused",
    scanned: { value: "—", sub: "" },
    flagged: { value: "—", sub: "" },
    lastCheck: { value: "—", sub: "" },
    alertWhen: { value: "—", sub: "" },
    spark: [],
  },
];

export const MONITOR_ALERTS: MonitorAlert[] = [
  {
    id: "a1",
    title: "Deepfake video flagged on @TechAuthority channel",
    source: "YouTube watch",
    meta: '"Exclusive: Founder reveals next product launch" · 2:14 · published 12m ago',
    verdictLabel: "Deepfake · 87%",
    when: "12m ago",
  },
  {
    id: "a2",
    title: "4 AI-generated images posted by @brand.handle",
    source: "X / Twitter watch",
    meta: "Thread of 6 posts · 4 images flagged as Midjourney v7 · ~91% conf.",
    verdictLabel: "AI images · 91%",
    when: "1h ago",
  },
  {
    id: "a3",
    title: "Voice clone detected in voicemail drop folder",
    source: "Folder watch",
    meta: "voicemail_2026-04-23_142.mp3 · 0:42 · ElevenLabs v3 match",
    verdictLabel: "Cloned · 88%",
    when: "3h ago",
  },
];

export const MONITOR_TEMPLATES: MonitorTemplate[] = [
  {
    id: "t1",
    kind: "youtube",
    name: "YouTube channel",
    desc: "Watch new uploads",
  },
  { id: "t2", kind: "x", name: "X / Twitter handle", desc: "Realtime post stream" },
  { id: "t3", kind: "rss", name: "RSS feed", desc: "Single or grouped feeds" },
  {
    id: "t4",
    kind: "folder",
    name: "Folder watch",
    desc: "Drive · Dropbox · local",
  },
  { id: "t5", kind: "url", name: "URL change", desc: "Watch any web page" },
  {
    id: "t6",
    kind: "telegram",
    name: "Telegram channel",
    desc: "Public channel watch",
  },
];

/* Reports page fixtures + types. Mirrors lib/monitors-data.ts in shape:
   types alongside hand-curated mock rows so the page renders without an
   API. Replace with real data once the reports backend lands. */

import type { IconName } from "@/components/Icon";

export type TemplateTone = "human" | "ai" | "mixed" | "info" | "gold" | "neutral";

export type Template = {
  id: string;
  name: string;
  description: string;
  /** Foot line under the description, e.g. "PDF · 4pp". */
  formatNote: string;
  icon: IconName;
  tone: TemplateTone;
  /** Custom template card uses a dashed border instead of a tinted icon. */
  custom?: boolean;
};

export const TEMPLATES: Template[] = [
  {
    id: "classroom",
    name: "Classroom grading",
    description:
      "Per-student verdicts with highlighted passages and confidence scores. Designed for teachers.",
    formatNote: "PDF · ~1 page each",
    icon: "users",
    tone: "human",
  },
  {
    id: "newsroom",
    name: "Newsroom verify",
    description:
      "Source provenance, model match, side-by-side originals. Sharable with editors and legal.",
    formatNote: "PDF · 3–5 pages",
    icon: "file-text",
    tone: "ai",
  },
  {
    id: "research",
    name: "Research dataset",
    description:
      "Tagged samples with full metadata, exportable for analysis. CSV + methodology PDF.",
    formatNote: "CSV + PDF",
    icon: "layers",
    tone: "info",
  },
  {
    id: "legal",
    name: "Legal evidence",
    description:
      "Chain-of-custody timestamps, hash verification, expert-style narrative format.",
    formatNote: "PDF · signed",
    icon: "shield",
    tone: "gold",
  },
  {
    id: "hiring",
    name: "Hiring review",
    description:
      "Applicant submissions and portfolio scans, summary with anonymization options.",
    formatNote: "PDF · ~2 pages",
    icon: "user",
    tone: "mixed",
  },
  {
    id: "custom",
    name: "Custom report",
    description:
      "Pick fields, layout, and format yourself. Save as your own template for next time.",
    formatNote: "Build it",
    icon: "sparkle",
    tone: "neutral",
    custom: true,
  },
];

export type ReportFormat = "pdf" | "link" | "team" | "csv";

export type ReportStatus =
  | "shared"
  | "public"
  | "team"
  | "draft"
  | "expired"
  | "ready"
  | "sent"
  | "downloaded";

export type ReportBand = "ai" | "human" | "mixed";

export type ReportStat = { icon: IconName; label: string };

export type Report = {
  id: string;
  title: string;
  source: string;
  meta: string;
  format: ReportFormat;
  /** Right-side label after the format chip, e.g. "PDF · 4pp". */
  formatLabel: string;
  status: ReportStatus;
  statusLabel: string;
  bands: ReportBand[];
  stats: [ReportStat, ReportStat];
  updatedRel: string;
  updatedAbs: string;
  /** When true the doc-preview thumbnail dims (draft / expired). */
  dim?: boolean;
};

export const REPORTS: Report[] = [
  {
    id: "fall-week-6",
    title: "Fall semester essays — Week 6 grading report",
    source: "Fall semester essays",
    meta: "11 items · 4 flagged AI",
    format: "pdf",
    formatLabel: "PDF · 4pp",
    status: "shared",
    statusLabel: "Shared",
    bands: ["ai"],
    stats: [
      { icon: "eye", label: "17 views · 2 today" },
      { icon: "upload", label: "3 downloads" },
    ],
    updatedRel: "2h ago",
    updatedAbs: "Apr 24 · 09:14",
  },
  {
    id: "election-week-apr19",
    title: "Election 2026 deepfake verification — Week of Apr 19",
    source: "Election 2026 fact-checks",
    meta: "23 items · 18 flagged AI",
    format: "link",
    formatLabel: "Public link",
    status: "public",
    statusLabel: "Public",
    bands: ["mixed", "ai"],
    stats: [
      { icon: "eye", label: "1,427 views" },
      { icon: "share", label: "34 reshares" },
    ],
    updatedRel: "Yesterday",
    updatedAbs: "Apr 23 · 16:42",
  },
  {
    id: "newsroom-april",
    title: "Newsroom verification queue — April summary",
    source: "Newsroom verification queue",
    meta: "26 items · 8 flagged AI",
    format: "team",
    formatLabel: "Team link",
    status: "team",
    statusLabel: "Team only",
    bands: ["human", "mixed"],
    stats: [
      { icon: "users", label: "Shared with 4" },
      { icon: "file-text", label: "3 comments" },
    ],
    updatedRel: "Yesterday",
    updatedAbs: "Apr 23 · 11:08",
  },
  {
    id: "music-deepfakes",
    title: "AI music deepfakes — research dataset export",
    source: "AI music deepfakes study",
    meta: "34 items · 22 flagged AI",
    format: "csv",
    formatLabel: "CSV · 12 KB",
    status: "downloaded",
    statusLabel: "Downloaded",
    bands: ["ai", "ai"],
    stats: [
      { icon: "upload", label: "1 download · you" },
      { icon: "list", label: "34 rows · 18 cols" },
    ],
    updatedRel: "3 days ago",
    updatedAbs: "Apr 21 · 14:20",
  },
  {
    id: "q4-marketing",
    title: "Q4 marketing audit — untitled draft",
    source: "Q4 marketing audit",
    meta: "17 items selected",
    format: "pdf",
    formatLabel: "PDF · pending",
    status: "draft",
    statusLabel: "Draft",
    bands: [],
    stats: [
      { icon: "settings", label: "You started this" },
      { icon: "refresh", label: "Auto-saved" },
    ],
    updatedRel: "4 days ago",
    updatedAbs: "Apr 20 · 10:45",
    dim: true,
  },
  {
    id: "recruiting-q1",
    title: "Recruiting portfolio review — Q1 candidates",
    source: "Recruiting portfolio review",
    meta: "10 items · 4 flagged AI",
    format: "link",
    formatLabel: "Public link",
    status: "expired",
    statusLabel: "Expired",
    bands: ["mixed"],
    stats: [
      { icon: "eye", label: "284 views · before" },
      { icon: "lock", label: "Expired Apr 18" },
    ],
    updatedRel: "1 week ago",
    updatedAbs: "Apr 17 · 13:10",
    dim: true,
  },
  {
    id: "voicemail-evidence",
    title: "Voicemail clone — evidence packet for case 24-0481",
    source: "Voicemail drops monitor",
    meta: "1 item · chain-of-custody",
    format: "pdf",
    formatLabel: "Signed PDF",
    status: "sent",
    statusLabel: "Sent",
    bands: ["ai"],
    stats: [
      { icon: "send", label: "Sent to legal@" },
      { icon: "check", label: "Hash verified" },
    ],
    updatedRel: "1 week ago",
    updatedAbs: "Apr 17 · 09:33",
  },
];

export const FORMAT_FILTERS = ["all", "pdf", "link", "team", "csv"] as const;
export const STATUS_FILTERS = [
  "all",
  "shared",
  "draft",
  "expired",
] as const;

export const REPORTS_QUOTA = {
  used: 14,
  total: 50,
  shared: 6,
};

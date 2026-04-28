export type TeamRole = "owner" | "admin" | "member" | "viewer" | "pending";
export type TeamPresence = "online" | "away" | "offline";

export type TeamMember = {
  id: string;
  initials: string;
  name: string;
  email: string;
  role: TeamRole;
  presence: TeamPresence;
  tokensThisMonth: number;
  tokensQuota: number;
  lastActive: { headline: string; sub: string };
  isYou?: boolean;
};

export type SharedCollectionTone = "ai" | "human" | "info" | "mixed";
export type SharedCollectionPermission = "EDIT" | "VIEW";

export type SharedCollectionRef = {
  id: string;
  name: string;
  meta: string;
  tone: SharedCollectionTone;
  collaborators: { initials: string }[];
  permission: SharedCollectionPermission;
};

export type AuditEntry = {
  id: string;
  actorInitials: string;
  /** Lightweight rich-text: **bold** for actor / target names, *italic* for collection names. */
  text: string;
  meta: string;
};

export type Workspace = {
  emblem: string;
  name: string;
  tagline: string;
  subdomain: string;
  createdLabel: string;
  seatsUsed: number;
  seatsTotal: number;
  renewsLabel: string;
  plan: "Team" | "Pro" | "Free";
};

export const WORKSPACE: Workspace = {
  emblem: "M",
  name: "Maple Newsroom",
  tagline: "verification team",
  subdomain: "maple-newsroom",
  createdLabel: "Aug 14, 2025",
  seatsUsed: 5,
  seatsTotal: 8,
  renewsLabel: "May 14",
  plan: "Team",
};

export const TEAM_MEMBERS: TeamMember[] = [
  {
    id: "bm",
    initials: "BM",
    name: "Boufarssi Moussa",
    email: "boufarssi@maple.news",
    role: "owner",
    presence: "online",
    tokensThisMonth: 61_400,
    tokensQuota: 95_000,
    lastActive: { headline: "Online", sub: "now" },
    isYou: true,
  },
  {
    id: "tk",
    initials: "TK",
    name: "Tara Khoury",
    email: "tara@maple.news",
    role: "admin",
    presence: "online",
    tokensThisMonth: 52_800,
    tokensQuota: 95_000,
    lastActive: { headline: "Active", sub: "5m ago" },
  },
  {
    id: "da",
    initials: "DA",
    name: "Daniel Abramov",
    email: "daniel@maple.news",
    role: "member",
    presence: "online",
    tokensThisMonth: 34_200,
    tokensQuota: 95_000,
    lastActive: { headline: "Active", sub: "22m ago" },
  },
  {
    id: "ns",
    initials: "NS",
    name: "Nadia Saleh",
    email: "nadia@maple.news",
    role: "member",
    presence: "away",
    tokensThisMonth: 28_700,
    tokensQuota: 95_000,
    lastActive: { headline: "Yesterday", sub: "17:12" },
  },
  {
    id: "jc",
    initials: "JC",
    name: "Joon Choi",
    email: "joon@maple.news",
    role: "viewer",
    presence: "offline",
    tokensThisMonth: 9_500,
    tokensQuota: 95_000,
    lastActive: { headline: "3d ago", sub: "Apr 21" },
  },
  {
    id: "lr",
    initials: "LR",
    name: "Lina Rosenthal",
    email: "lina@maple.news",
    role: "pending",
    presence: "offline",
    tokensThisMonth: 0,
    tokensQuota: 0,
    lastActive: { headline: "Sent", sub: "4 days ago" },
  },
];

export const PENDING_INVITE = {
  name: "Lina R.",
  sentLabel: "4 days ago",
};

export const SHARED_COLLECTIONS: SharedCollectionRef[] = [
  {
    id: "election-2026",
    name: "Election 2026 fact-checks",
    meta: "88 items · 67 flagged",
    tone: "ai",
    collaborators: [{ initials: "BM" }, { initials: "DA" }, { initials: "NS" }],
    permission: "EDIT",
  },
  {
    id: "newsroom-queue",
    name: "Newsroom verification queue",
    meta: "26 items · 8 flagged",
    tone: "human",
    collaborators: [{ initials: "BM" }, { initials: "TK" }, { initials: "DA" }],
    permission: "EDIT",
  },
  {
    id: "ai-music",
    name: "AI music deepfakes study",
    meta: "34 items · 22 flagged",
    tone: "info",
    collaborators: [{ initials: "BM" }, { initials: "JC" }],
    permission: "VIEW",
  },
  {
    id: "q4-marketing",
    name: "Q4 marketing audit",
    meta: "17 items · 9 flagged",
    tone: "mixed",
    collaborators: [{ initials: "BM" }, { initials: "NS" }],
    permission: "EDIT",
  },
  {
    id: "fall-essays",
    name: "Fall semester essays",
    meta: "42 items · 11 flagged",
    tone: "human",
    collaborators: [{ initials: "BM" }, { initials: "TK" }],
    permission: "EDIT",
  },
];

export const AUDIT_LOG: AuditEntry[] = [
  {
    id: "a1",
    actorInitials: "TK",
    text: "**Tara** shared *Newsroom verification queue* with the team",
    meta: "12m ago · maple-newsroom",
  },
  {
    id: "a2",
    actorInitials: "DA",
    text: "**Daniel** exported a report from *Election 2026 fact-checks*",
    meta: "42m ago · 1,427 views",
  },
  {
    id: "a3",
    actorInitials: "BM",
    text: "**You** changed **Joon** to *Viewer*",
    meta: "3h ago",
  },
  {
    id: "a4",
    actorInitials: "BM",
    text: "**You** invited **lina@maple.news**",
    meta: "4 days ago · still pending",
  },
  {
    id: "a5",
    actorInitials: "NS",
    text: "**Nadia** joined the workspace",
    meta: "2 weeks ago · invited by Tara",
  },
];

export const BILLING = {
  planLabel: "Team · annual",
  seatsLabel: "5 of 8",
  pooledTokens: "500k / mo",
  nextInvoice: "$1,920",
  invoiceUnit: "/yr",
  renews: "May 14, 2026",
  addSeatsCta: "Add 3 more seats — $720/yr",
};

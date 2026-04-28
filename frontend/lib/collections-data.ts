import type { ScanType } from "@/components/ui/TypeChip";
import type { PillTone } from "@/components/ui/Pill";
import type { IconName } from "@/components/Icon";

export type CollectionTone =
  | "human"
  | "ai"
  | "mixed"
  | "info"
  | "gold"
  | "neutral";

export type CollectionPattern = "dots" | "grid" | "lines";

export type Collaborator = { initials: string };

export type CollectionMember = {
  initials: string;
  name: string;
  /** "Owner" | "Editor" | "Viewer" */
  role: string;
  emailHandle: string;
  you?: boolean;
};

export type CollectionRule = {
  id: string;
  icon: IconName;
  text: string;
  active: boolean;
};

export type CollectionActivity = {
  id: string;
  initials: string;
  /** Mini rich-text: "**Tara** tagged *essay_208* as Follow-up needed" */
  actor: string;
  /** Already-formatted body (with optional `<em>` and `<strong>`-style spans). */
  text: string;
  emphasis?: string;
  when: string;
};

/** A scan that lives in this collection. Lighter than LibraryItem — just
 *  the fields the detail-page table renders. */
export type CollectionItem = {
  id: string;
  type: ScanType;
  name: string;
  tag?: string;
  meta: string;
  confidence: number;
  model: string;
  verdict: PillTone;
  verdictLabel: string;
  when: string;
};

export type Collection = {
  id: string;
  /** URL-safe slug used in the route (`/app/collections/[slug]`). */
  slug: string;
  title: string;
  description: string;
  tone: CollectionTone;
  pattern: CollectionPattern;
  /** Cover thumbnail strip (3–4 type tiles). */
  thumbs: ScanType[];
  extraCount?: number;
  itemCount: number;
  flagged: number;
  /** 0–100 whole-number percent. */
  aiRate: number;
  /** Avg confidence for the whole collection (0–100). */
  avgConfidence: number;
  topModel: string;
  topModelHits: number;
  graded: number;
  pending: number;
  created: string;
  updated: string;
  pinned?: boolean;
  collaborators: Collaborator[];
  members: CollectionMember[];
  rules: CollectionRule[];
  activity: CollectionActivity[];
  items: CollectionItem[];
};

export type CollectionTemplate = {
  id: string;
  name: string;
  description: string;
  icon: IconName;
  tone: CollectionTone;
};

const FALL_ESSAYS_ITEMS: CollectionItem[] = [
  {
    id: "i1",
    type: "txt",
    name: "student_essay_214.txt",
    tag: "Week 6",
    meta: "1,430 words · Jamie R.",
    confidence: 89,
    model: "GPT-5",
    verdict: "ai",
    verdictLabel: "AI-written",
    when: "2h ago",
  },
  {
    id: "i2",
    type: "txt",
    name: "student_essay_208.txt",
    tag: "Week 6",
    meta: "1,180 words · Morgan T.",
    confidence: 94,
    model: "GPT-5",
    verdict: "ai",
    verdictLabel: "AI-written",
    when: "3h ago",
  },
  {
    id: "i3",
    type: "txt",
    name: "student_essay_196.txt",
    tag: "Week 5",
    meta: "1,520 words · Alex P.",
    confidence: 71,
    model: "Claude 4.5",
    verdict: "mixed",
    verdictLabel: "Some AI",
    when: "Yesterday",
  },
  {
    id: "i4",
    type: "txt",
    name: "student_essay_187.txt",
    tag: "Week 5",
    meta: "1,290 words · Sam K.",
    confidence: 85,
    model: "GPT-5",
    verdict: "ai",
    verdictLabel: "AI-written",
    when: "Yesterday",
  },
  {
    id: "i5",
    type: "txt",
    name: "student_essay_173.txt",
    tag: "Week 4",
    meta: "1,410 words · Riley C.",
    confidence: 92,
    model: "GPT-5",
    verdict: "ai",
    verdictLabel: "AI-written",
    when: "2d ago",
  },
  {
    id: "i6",
    type: "txt",
    name: "student_essay_162.txt",
    tag: "Week 4",
    meta: "1,340 words · Casey W.",
    confidence: 78,
    model: "Claude 4.5",
    verdict: "mixed",
    verdictLabel: "Some AI",
    when: "3d ago",
  },
  {
    id: "i7",
    type: "txt",
    name: "student_essay_154.txt",
    tag: "Week 3",
    meta: "1,265 words · Drew L.",
    confidence: 96,
    model: "GPT-5",
    verdict: "ai",
    verdictLabel: "AI-written",
    when: "4d ago",
  },
  {
    id: "i8",
    type: "txt",
    name: "student_essay_142.txt",
    tag: "Week 3",
    meta: "1,495 words · Taylor F.",
    confidence: 88,
    model: "GPT-5",
    verdict: "ai",
    verdictLabel: "AI-written",
    when: "5d ago",
  },
  {
    id: "i9",
    type: "txt",
    name: "student_essay_128.txt",
    tag: "Week 2",
    meta: "1,370 words · Jordan M.",
    confidence: 82,
    model: "GPT-5",
    verdict: "ai",
    verdictLabel: "AI-written",
    when: "1w ago",
  },
  {
    id: "i10",
    type: "txt",
    name: "student_essay_116.txt",
    tag: "Week 2",
    meta: "1,250 words · Quinn B.",
    confidence: 74,
    model: "Claude 4.5",
    verdict: "mixed",
    verdictLabel: "Some AI",
    when: "1w ago",
  },
  {
    id: "i11",
    type: "txt",
    name: "student_essay_107.txt",
    tag: "Week 1",
    meta: "1,180 words · Avery N.",
    confidence: 91,
    model: "GPT-5",
    verdict: "ai",
    verdictLabel: "AI-written",
    when: "2w ago",
  },
];

const FALL_ESSAYS_MEMBERS: CollectionMember[] = [
  {
    initials: "BM",
    name: "Boufarssi M.",
    role: "Owner",
    emailHandle: "boufarssi@",
    you: true,
  },
  { initials: "TK", name: "Tara K.", role: "Editor", emailHandle: "tara@" },
];

const FALL_ESSAYS_RULES: CollectionRule[] = [
  {
    id: "r1",
    icon: "eye",
    text: "Auto-add essays uploaded from “Fall 2025” folder",
    active: true,
  },
  {
    id: "r2",
    icon: "bell",
    text: "Email Tara when confidence ≥ 85%",
    active: true,
  },
  {
    id: "r3",
    icon: "refresh",
    text: "Re-scan all items when new model ships",
    active: false,
  },
];

const FALL_ESSAYS_ACTIVITY: CollectionActivity[] = [
  {
    id: "a1",
    initials: "BM",
    actor: "You",
    text: "added",
    emphasis: "4 items from Week 6 submissions",
    when: "2h ago",
  },
  {
    id: "a2",
    initials: "TK",
    actor: "Tara",
    text: "tagged",
    emphasis: "essay_208 as “Follow-up needed”",
    when: "3h ago",
  },
  {
    id: "a3",
    initials: "BM",
    actor: "You",
    text: "exported a grading report",
    when: "Yesterday",
  },
  {
    id: "a4",
    initials: "TK",
    actor: "Tara",
    text: "joined the collection",
    when: "3w ago",
  },
];

/** Lightweight default detail records for collections that don't have
 *  hand-tuned content yet. Keeps every detail page renderable. */
function defaultDetail(collaborators: Collaborator[]): {
  members: CollectionMember[];
  rules: CollectionRule[];
  activity: CollectionActivity[];
  items: CollectionItem[];
} {
  return {
    members: collaborators.map((c, i) => ({
      initials: c.initials,
      name: c.initials,
      role: i === 0 ? "Owner" : "Editor",
      emailHandle: `${c.initials.toLowerCase()}@`,
      you: i === 0,
    })),
    rules: [
      {
        id: "rd1",
        icon: "eye",
        text: "Auto-add scans tagged with this collection",
        active: true,
      },
      {
        id: "rd2",
        icon: "refresh",
        text: "Re-scan when new model ships",
        active: false,
      },
    ],
    activity: [
      {
        id: "ad1",
        initials: collaborators[0]?.initials ?? "BM",
        actor: "You",
        text: "created the collection",
        when: "Recently",
      },
    ],
    items: [],
  };
}

const FALL_ESSAYS_DEFAULT: Collection = {
  id: "c1",
  slug: "fall-semester-essays",
  title: "Fall semester essays",
  description:
    "Student submissions for English 201 · personal narrative assignment · graded weekly. Flagged items trigger a follow-up conversation before grading.",
  tone: "human",
  pattern: "dots",
  thumbs: ["txt", "txt", "txt"],
  extraCount: 39,
  itemCount: 42,
  flagged: 11,
  aiRate: 26,
  avgConfidence: 91,
  topModel: "GPT-5",
  topModelHits: 8,
  graded: 36,
  pending: 6,
  created: "Sep 3, 2025",
  updated: "Updated 2h ago",
  pinned: true,
  collaborators: [{ initials: "BM" }, { initials: "TK" }],
  members: FALL_ESSAYS_MEMBERS,
  rules: FALL_ESSAYS_RULES,
  activity: FALL_ESSAYS_ACTIVITY,
  items: FALL_ESSAYS_ITEMS,
};

export const COLLECTIONS: Collection[] = [
  FALL_ESSAYS_DEFAULT,
  {
    id: "c2",
    slug: "election-2026-fact-checks",
    title: "Election 2026 fact-checks",
    description:
      "Suspicious campaign media flagged by extension while browsing · cross-platform sources",
    tone: "ai",
    pattern: "grid",
    thumbs: ["img", "vid", "aud", "soc"],
    extraCount: 84,
    itemCount: 88,
    flagged: 67,
    aiRate: 76,
    avgConfidence: 87,
    topModel: "Sora 2",
    topModelHits: 24,
    graded: 67,
    pending: 21,
    created: "Jan 14, 2026",
    updated: "Updated 18m ago",
    pinned: true,
    collaborators: [
      { initials: "BM" },
      { initials: "LR" },
      { initials: "DA" },
    ],
    ...defaultDetail([
      { initials: "BM" },
      { initials: "LR" },
      { initials: "DA" },
    ]),
  },
  {
    id: "c3",
    slug: "newsroom-verification-queue",
    title: "Newsroom verification queue",
    description:
      "Tip-line submissions and wire photos pending authenticity checks before publication",
    tone: "gold",
    pattern: "lines",
    thumbs: ["img", "web", "soc"],
    extraCount: 23,
    itemCount: 26,
    flagged: 8,
    aiRate: 30,
    avgConfidence: 84,
    topModel: "Midjourney v7",
    topModelHits: 5,
    graded: 18,
    pending: 8,
    created: "Feb 02, 2026",
    updated: "Updated 4h ago",
    collaborators: [
      { initials: "BM" },
      { initials: "TK" },
      { initials: "LR" },
    ],
    ...defaultDetail([
      { initials: "BM" },
      { initials: "TK" },
      { initials: "LR" },
    ]),
  },
  {
    id: "c4",
    slug: "ai-music-deepfakes-study",
    title: "AI music deepfakes study",
    description:
      "Research dataset: voice-cloned tracks vs originals · for paper on auditory detection",
    tone: "info",
    pattern: "dots",
    thumbs: ["aud", "aud", "vid"],
    extraCount: 31,
    itemCount: 34,
    flagged: 22,
    aiRate: 65,
    avgConfidence: 79,
    topModel: "ElevenLabs v3",
    topModelHits: 14,
    graded: 22,
    pending: 12,
    created: "Mar 11, 2026",
    updated: "Updated yesterday",
    collaborators: [{ initials: "BM" }],
    ...defaultDetail([{ initials: "BM" }]),
  },
  {
    id: "c5",
    slug: "q4-marketing-audit",
    title: "Q4 marketing audit",
    description:
      "Checking competitor ad creative and landing pages for AI-generated content",
    tone: "mixed",
    pattern: "grid",
    thumbs: ["txt", "img", "web"],
    extraCount: 14,
    itemCount: 17,
    flagged: 9,
    aiRate: 53,
    avgConfidence: 81,
    topModel: "GPT-5",
    topModelHits: 6,
    graded: 12,
    pending: 5,
    created: "Mar 24, 2026",
    updated: "Updated 2d ago",
    collaborators: [{ initials: "BM" }, { initials: "DA" }],
    ...defaultDetail([{ initials: "BM" }, { initials: "DA" }]),
  },
  {
    id: "c6",
    slug: "recruiting-portfolio-review",
    title: "Recruiting portfolio review",
    description:
      "Applicant work samples for senior designer role · screening for AI-generated portfolios",
    tone: "ai",
    pattern: "lines",
    thumbs: ["img", "txt"],
    extraCount: 8,
    itemCount: 10,
    flagged: 4,
    aiRate: 40,
    avgConfidence: 86,
    topModel: "Midjourney v7",
    topModelHits: 3,
    graded: 7,
    pending: 3,
    created: "Apr 01, 2026",
    updated: "Updated 4d ago",
    collaborators: [{ initials: "BM" }],
    ...defaultDetail([{ initials: "BM" }]),
  },
  {
    id: "c7",
    slug: "personal-verifications",
    title: "Personal verifications",
    description:
      "Stuff I've spotted in the wild — receipts, screenshots, messages I wanted to double-check",
    tone: "neutral",
    pattern: "dots",
    thumbs: ["img", "aud", "soc"],
    itemCount: 7,
    flagged: 3,
    aiRate: 43,
    avgConfidence: 76,
    topModel: "Mixed",
    topModelHits: 0,
    graded: 7,
    pending: 0,
    created: "Apr 14, 2026",
    updated: "Updated last week",
    collaborators: [{ initials: "BM" }],
    ...defaultDetail([{ initials: "BM" }]),
  },
];

export function getCollection(slugOrId: string): Collection | undefined {
  return COLLECTIONS.find((c) => c.slug === slugOrId || c.id === slugOrId);
}

export const TEMPLATES: CollectionTemplate[] = [
  {
    id: "t1",
    name: "Classroom grading",
    description: "Essay batch + grading report",
    icon: "users",
    tone: "human",
  },
  {
    id: "t2",
    name: "Newsroom verify",
    description: "Tip-line + wire photos",
    icon: "file-text",
    tone: "gold",
  },
  {
    id: "t3",
    name: "Research dataset",
    description: "Tagged samples + export",
    icon: "cube",
    tone: "info",
  },
  {
    id: "t4",
    name: "Hiring review",
    description: "Applications + portfolios",
    icon: "shield",
    tone: "mixed",
  },
  {
    id: "t5",
    name: "Legal evidence",
    description: "Chain-of-custody report",
    icon: "lock",
    tone: "ai",
  },
  {
    id: "t6",
    name: "Custom",
    description: "Configure your own",
    icon: "sparkle",
    tone: "neutral",
  },
];

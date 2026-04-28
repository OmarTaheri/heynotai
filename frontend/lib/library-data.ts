import type { ScanType } from "@/components/ui/TypeChip";
import type { Origin } from "@/components/ui/OriginBadge";
import type { PillTone } from "@/components/ui/Pill";

export type LibraryVerdict = PillTone;

/** Structured replacement for the noisy full-URL source string on social
 *  posts. `format` is the human-friendly content-type ("video" / "short"
 *  / "reel" / "post"); `id` is the post's unique slug; `url` is the full
 *  https URL copied to the clipboard when the row's link is clicked. */
export type LibrarySourceLink = {
  format: string;
  id: string;
  url: string;
};

export type LibraryItem = {
  id: string;
  type: ScanType;
  name: string;
  origin: Origin;
  source: string;
  /** When set, the row renders a clickable "format · id" link in place
   *  of the plain `source` string. */
  link?: LibrarySourceLink;
  meta?: string;
  confidence: number;
  model: string;
  verdict: LibraryVerdict;
  verdictLabel: string;
  when: string;
};

export type OriginTabKey =
  | "all"
  | "up"
  | "ext"
  | "url"
  | "paste"
  | "mon";

export const ORIGIN_TABS: { key: OriginTabKey; label: string; count: number }[] = [
  { key: "all", label: "All", count: 470 },
  { key: "up", label: "Uploads", count: 128 },
  { key: "ext", label: "Extension", count: 298 },
  { key: "url", label: "URLs", count: 28 },
  { key: "paste", label: "Pasted", count: 12 },
  { key: "mon", label: "Monitors", count: 4 },
];

/** Human-readable labels for every supported content type. Keep in sync
 *  with `ScanType` in `components/ui/TypeChip.tsx`. */
export const TYPE_LABELS: Record<ScanType, string> = {
  txt: "Text",
  img: "Image",
  aud: "Audio",
  vid: "Video",
  web: "Website",
  soc: "Social post",
  "fb-vid": "Facebook video",
  "fb-reel": "Facebook reel",
  "fb-post": "Facebook post",
  "ig-reel": "Instagram reel",
  "ig-post-img": "Instagram post · image",
  "ig-post-vid": "Instagram post · video",
  "yt-vid": "YouTube video",
  "yt-reel": "YouTube short",
};

export const LIBRARY_ITEMS: LibraryItem[] = [
  {
    id: "l1",
    type: "vid",
    name: "Celebrity Interview — Exclusive Reveal About Upcoming Project",
    origin: "up",
    source: "interview_cut.mp4 · 2:14",
    meta: "1080p",
    confidence: 87,
    model: "Sora 2",
    verdict: "ai",
    verdictLabel: "Deepfake",
    when: "12m ago",
  },
  {
    id: "l2",
    type: "img",
    name: "linkedin_headshot.jpg",
    origin: "up",
    source: "1024 × 1024",
    meta: "recruiting review",
    confidence: 92,
    model: "Midjourney v7",
    verdict: "ai",
    verdictLabel: "AI-generated",
    when: "42m ago",
  },
  {
    id: "l3",
    type: "txt",
    name: "student_essay_214.txt",
    origin: "up",
    source: "1,430 words",
    meta: "Fall semester",
    confidence: 89,
    model: "GPT-5",
    verdict: "ai",
    verdictLabel: "AI-written",
    when: "1h ago",
  },
  {
    id: "l4",
    type: "aud",
    name: "voicemail_from_boss.mp3",
    origin: "mon",
    source: "0:42",
    meta: "monitor: voicemail drops",
    confidence: 88,
    model: "ElevenLabs v3",
    verdict: "ai",
    verdictLabel: "Cloned voice",
    when: "1h ago",
  },
  {
    id: "l5",
    type: "web",
    name: "EU agrees new framework on synthetic media labelling",
    origin: "url",
    source: "bbc.com/news/technology-68921",
    meta: "full page scan",
    confidence: 96,
    model: "—",
    verdict: "human",
    verdictLabel: "Authentic",
    when: "2h ago",
  },
  {
    id: "l6",
    type: "yt-vid",
    name: "“The science of why we procrastinate (and how to stop)”",
    origin: "ext",
    source: "youtube.com/watch?v=xK2Qjm4bN7",
    link: {
      format: "video",
      id: "xK2Qjm4bN7",
      url: "https://youtube.com/watch?v=xK2Qjm4bN7",
    },
    meta: "8:42",
    confidence: 73,
    model: "ElevenLabs v3",
    verdict: "mixed",
    verdictLabel: "AI narration",
    when: "3h ago",
  },
  {
    id: "l7",
    type: "yt-reel",
    name: "“POV: I tried the productivity method nobody talks about”",
    origin: "ext",
    source: "youtube.com/shorts/7234kqLm",
    link: {
      format: "short",
      id: "7234kqLm",
      url: "https://youtube.com/shorts/7234kqLm",
    },
    meta: "0:28 vertical",
    confidence: 82,
    model: "ElevenLabs v3",
    verdict: "ai",
    verdictLabel: "AI voice",
    when: "4h ago",
  },
  {
    id: "l8",
    type: "ig-reel",
    name: "“Sunrise at Lake Como — 24 hours in Italy”",
    origin: "ext",
    source: "instagram.com/reel/C8jK4nRoP",
    link: {
      format: "reel",
      id: "C8jK4nRoP",
      url: "https://instagram.com/reel/C8jK4nRoP",
    },
    meta: "0:31 · vertical",
    confidence: 78,
    model: "Sora 2",
    verdict: "ai",
    verdictLabel: "AI clip",
    when: "5h ago",
  },
  {
    id: "l9",
    type: "ig-post-img",
    name: "“Golden hour, no filter ✨” — travel influencer post",
    origin: "ext",
    source: "instagram.com/p/C7nB2qwLk",
    link: {
      format: "post",
      id: "C7nB2qwLk",
      url: "https://instagram.com/p/C7nB2qwLk",
    },
    meta: "single image",
    confidence: 88,
    model: "Midjourney v7",
    verdict: "ai",
    verdictLabel: "AI image",
    when: "Yesterday",
  },
  {
    id: "l10",
    type: "ig-post-vid",
    name: "“Behind the scenes from yesterday's shoot 🎬”",
    origin: "ext",
    source: "instagram.com/p/C7vM9xRoS",
    link: {
      format: "post",
      id: "C7vM9xRoS",
      url: "https://instagram.com/p/C7vM9xRoS",
    },
    meta: "0:48 in-feed",
    confidence: 64,
    model: "Runway Gen-4",
    verdict: "mixed",
    verdictLabel: "Some AI",
    when: "Yesterday",
  },
  {
    id: "l11",
    type: "fb-vid",
    name: "“Local hero saves dog from frozen lake — full footage”",
    origin: "ext",
    source: "facebook.com/watch?v=8312",
    link: {
      format: "video",
      id: "8312",
      url: "https://facebook.com/watch?v=8312",
    },
    meta: "1:42",
    confidence: 91,
    model: "Sora 2",
    verdict: "ai",
    verdictLabel: "Deepfake",
    when: "Yesterday",
  },
  {
    id: "l12",
    type: "fb-reel",
    name: "“What nobody tells you about your 30s”",
    origin: "ext",
    source: "facebook.com/reel/c7wQ9p",
    link: {
      format: "reel",
      id: "c7wQ9p",
      url: "https://facebook.com/reel/c7wQ9p",
    },
    meta: "0:22 vertical",
    confidence: 70,
    model: "ElevenLabs v3",
    verdict: "mixed",
    verdictLabel: "AI voice",
    when: "2d ago",
  },
  {
    id: "l13",
    type: "fb-post",
    name: "“Breaking: A new study shows that AI-generated images now fool 8 in 10…”",
    origin: "ext",
    source: "facebook.com/posts/1823",
    link: {
      format: "post",
      id: "1823",
      url: "https://facebook.com/posts/1823",
    },
    meta: "text + link",
    confidence: 85,
    model: "GPT-5",
    verdict: "ai",
    verdictLabel: "AI-written",
    when: "2d ago",
  },
];

"use client";

import { useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/lib/auth";
import { pb } from "@/lib/pocketbase";
import { ScoreRing, type RingTone } from "@/components/ui/ScoreRing";
import {
  AvatarCropModal,
  type AvatarPickerHandle,
} from "@/components/ui/AvatarCropModal";
import s from "./onboarding.module.css";

/* heynotai onboarding — 10-step flow ported from
 * heynotai-design-system/project/onboarding-app.jsx (the design bundle).
 * Submits the collected fields to PB on the final step. */

// ── Icons ──────────────────────────────────────────────────────────
type IconPath = string | string[];
function Path({ d }: { d: IconPath }) {
  return (
    <svg viewBox="0 0 24 24" aria-hidden>
      {Array.isArray(d) ? d.map((p, i) => <path key={i} d={p} />) : <path d={d} />}
    </svg>
  );
}
function CheckIcon() {
  return (
    <svg viewBox="0 0 24 24" aria-hidden>
      <polyline points="4,12 10,18 20,6" />
    </svg>
  );
}
const ic = {
  pen: "M4 20h4l10-10-4-4L4 16v4z M14 6l4 4",
  teach: "M3 8l9-4 9 4-9 4-9-4z M7 10v5c0 1.5 2.5 3 5 3s5-1.5 5-3v-5",
  hr: "M12 12a4 4 0 1 0 0-8 4 4 0 0 0 0 8z M4 21v-1a8 8 0 0 1 16 0v1 M16 7l2 2 4-4",
  mark: "M3 12l4-7h10l4 7-9 9-9-9z",
  research: "M11 19a8 8 0 1 1 0-16 8 8 0 0 1 0 16z M21 21l-5-5",
  dev: "M8 18l-5-6 5-6 M16 6l5 6-5 6 M14 4l-4 16",
  other: "M5 12h.01 M12 12h.01 M19 12h.01",
  news: "M3 5h14v14H3z M17 9h4v8a2 2 0 0 1-2 2 M6 9h8 M6 13h8 M6 17h5",
  grade: "M4 4h12v16l-6-3-6 3z M9 9h2 M9 13h2",
  hire: "M4 9h16v11H4z M4 9V6a2 2 0 0 1 2-2h12a2 2 0 0 1 2 2v3 M9 4v5 M15 4v5",
  team: "M9 11a4 4 0 1 0 0-8 4 4 0 0 0 0 8z M2 21v-1a7 7 0 0 1 14 0v1 M22 21v-1a6 6 0 0 0-5-5.91 M18 3a4 4 0 0 1 0 8",
  curious: "M12 21a9 9 0 1 1 0-18 9 9 0 0 1 0 18z M9 9a3 3 0 0 1 6 0c0 2-3 2-3 4 M12 17h.01",
  text: "M4 6h16M4 12h10M4 18h16",
  audio: "M9 18V6l11-2v12 M6 21a3 3 0 1 0 0-6 3 3 0 0 0 0 6z M17 19a3 3 0 1 0 0-6 3 3 0 0 0 0 6z",
  video: "M3 6h13v12H3z M16 10l5-3v10l-5-3z",
  image: "M3 3h18v18H3z M9 9a2 2 0 1 1 0-4 2 2 0 0 1 0 4z M21 15l-5-5L5 21",
  mail: "M3 6l9 7 9-7 M3 6h18v12H3z",
  spark4: "M12 2 C12 8 16 12 22 12 C16 12 12 16 12 22 C12 16 8 12 2 12 C8 12 12 8 12 2 Z",
};

// ── Data shape ─────────────────────────────────────────────────────
type OnboardingData = {
  name: string;
  handle: string;
  handleEdited: boolean;
  email: string;
  avatarUrl: string;
  role: string;
  useCases: string[];
  tz: string;
  lang: string;
  dateFmt: string;
  theme: "paper" | "night" | "system";
  showAuth: boolean;
  connections: string[];
  demoRan: boolean;
  demoSample: "ai" | "human" | "mixed";
};

type Setter = (patch: Partial<OnboardingData>) => void;

// ── Atoms ──────────────────────────────────────────────────────────
function Heading({
  eyebrow, title, sub, centered,
}: { eyebrow?: string; title: ReactNode; sub?: string; centered?: boolean }) {
  return (
    <div style={centered ? { textAlign: "center" } : undefined}>
      {eyebrow && <div className={s.eyebrow}>{eyebrow}</div>}
      <h1 className={s.title} style={centered ? { textAlign: "center" } : undefined}>{title}</h1>
      {sub && <p className={s.sub} style={centered ? { textAlign: "center", margin: "12px auto 0" } : undefined}>{sub}</p>}
    </div>
  );
}

function OptCard({
  selected, onClick, icon, title, desc,
}: { selected: boolean; onClick: () => void; icon: IconPath; title: string; desc?: string }) {
  return (
    <button
      type="button"
      className={`${s.optCard}${selected ? ` ${s.optCardSel}` : ""}`}
      onClick={onClick}
    >
      <span className={s.ic}><Path d={icon} /></span>
      <span className={s.ob}>
        <span className={s.ot}>{title}</span>
        {desc && <span className={s.od}>{desc}</span>}
      </span>
      <span className={s.ck}><CheckIcon /></span>
    </button>
  );
}

function Toggle({ on, onChange }: { on: boolean; onChange: (v: boolean) => void }) {
  return (
    <button
      type="button"
      className={`${s.tg}${on ? ` ${s.tgOn}` : ""}`}
      onClick={() => onChange(!on)}
      aria-pressed={on}
    />
  );
}

function ToggleRow({
  title, desc, on, onChange,
}: { title: string; desc: string; on: boolean; onChange: (v: boolean) => void }) {
  return (
    <div className={s.tgRow}>
      <div className={s.tgInfo}>
        <div className={s.tgInfoT}>{title}</div>
        <div className={s.tgInfoD}>{desc}</div>
      </div>
      <Toggle on={on} onChange={onChange} />
    </div>
  );
}

// ── Steps ──────────────────────────────────────────────────────────
function StepWelcome({
  data, set, onOpenCrop,
}: { data: OnboardingData; set: Setter; onOpenCrop: () => void }) {
  const initials =
    (data.name || "")
      .split(/\s+/)
      .filter(Boolean)
      .slice(0, 2)
      .map((w) => w[0])
      .join("")
      .toUpperCase() || "?";
  return (
    <div className={s.step}>
      <Heading
        eyebrow="Step 01 · Welcome"
        title="Hey. Let's set you up."
        sub="A few quick questions so heynotai surfaces the right verdicts in the right places. Most of this you can change later in Settings."
      />
      <div className={s.field} style={{ marginTop: 28 }}>
        <label>Profile picture</label>
        <div className={s.avatarRow}>
          <div className={s.avatar}>
            {data.avatarUrl ? <img src={data.avatarUrl} alt="" /> : initials}
          </div>
          <div className={s.avatarActions}>
            <button
              type="button"
              className={`${s.btn} ${s.btnGhost}`}
              onClick={onOpenCrop}
            >
              {data.avatarUrl ? "Change photo" : "Upload image"}
            </button>
            {data.avatarUrl && (
              <button
                type="button"
                className={`${s.btn} ${s.btnText}`}
                onClick={() => set({ avatarUrl: "" })}
              >
                Remove
              </button>
            )}
          </div>
        </div>
      </div>
      <div className={`${s.row2} ${s.row2Tight}`}>
        <div className={s.field}>
          <label>Full name</label>
          <input
            className={s.input}
            placeholder="Jane Doe"
            value={data.name}
            onChange={(e) =>
              set({
                name: e.target.value,
                handle: data.handleEdited
                  ? data.handle
                  : e.target.value.toLowerCase().replace(/\s+/g, ""),
              })
            }
          />
          <span className={s.hint}>Used in reports and team mentions</span>
        </div>
        <div className={s.field}>
          <label>Display handle</label>
          <input
            className={s.input}
            placeholder="janedoe"
            value={data.handle}
            onChange={(e) => set({ handle: e.target.value, handleEdited: true })}
          />
          <span className={s.hint}>Shown next to your activity</span>
        </div>
      </div>
      <div className={s.field}>
        <label>Email address</label>
        <input className={`${s.input} ${s.disabled}`} value={data.email} disabled />
        <span className={s.hint}>Used for sign-in and notifications</span>
      </div>
    </div>
  );
}

function StepRole({ data, set }: { data: OnboardingData; set: Setter }) {
  const roles = [
    { id: "journalist", icon: ic.pen, title: "Journalist", desc: "Verifying sources, quotes, and submitted material" },
    { id: "educator", icon: ic.teach, title: "Educator", desc: "Reviewing student work and submissions" },
    { id: "hr", icon: ic.hr, title: "HR & recruiting", desc: "Vetting applications, cover letters, portfolios" },
    { id: "marketing", icon: ic.mark, title: "Marketing & comms", desc: "QA on team copy and external content" },
    { id: "researcher", icon: ic.research, title: "Researcher", desc: "Studying AI content patterns at scale" },
    { id: "dev", icon: ic.dev, title: "Developer", desc: "Building on heynotai's API" },
    { id: "other", icon: ic.other, title: "Just curious", desc: "I'm trying to figure it out, same as everyone" },
  ];
  return (
    <div className={s.step}>
      <Heading
        eyebrow="Step 02 · Role"
        title="What brings you here?"
        sub="Pick the one that fits best — we'll tailor your default scan rules to it."
      />
      <div className={s.optGrid}>
        {roles.map((r) => (
          <OptCard
            key={r.id}
            selected={data.role === r.id}
            onClick={() => set({ role: r.id })}
            icon={r.icon}
            title={r.title}
            desc={r.desc}
          />
        ))}
      </div>
    </div>
  );
}

function StepUseCase({ data, set }: { data: OnboardingData; set: Setter }) {
  const opts = [
    { id: "news", icon: ic.news, title: "Verify news & sources", desc: "Articles, quotes, viral posts" },
    { id: "grade", icon: ic.grade, title: "Grade student work", desc: "Essays, take-home exams, lab reports" },
    { id: "hire", icon: ic.hire, title: "Vet candidates", desc: "Cover letters, take-home assignments" },
    { id: "team", icon: ic.team, title: "Review team copy", desc: "Internal drafts before they ship" },
    { id: "curious", icon: ic.curious, title: "Personal — just curious", desc: "I want to know what I'm reading" },
    { id: "api", icon: ic.dev, title: "Build with the API", desc: "Programmatic access for my product" },
  ];
  const toggle = (id: string) => {
    const set2 = new Set(data.useCases);
    set2.has(id) ? set2.delete(id) : set2.add(id);
    set({ useCases: [...set2] });
  };
  return (
    <div className={s.step}>
      <Heading
        eyebrow="Step 03 · Use case"
        title="What will you scan most?"
        sub="Pick all that apply."
      />
      <div className={s.optGrid}>
        {opts.map((o) => (
          <OptCard
            key={o.id}
            selected={data.useCases.includes(o.id)}
            onClick={() => toggle(o.id)}
            icon={o.icon}
            title={o.title}
            desc={o.desc}
          />
        ))}
      </div>
    </div>
  );
}

function StepWorkspace({ data, set }: { data: OnboardingData; set: Setter }) {
  const langs = ["English", "Español", "Français", "Deutsch", "Português", "日本語"];
  const dfs = ["24 Apr 2026", "Apr 24, 2026", "2026-04-24", "24/04/2026"];
  return (
    <div className={s.step}>
      <Heading
        eyebrow="Step 04 · Workspace"
        title="Make it feel like yours."
        sub="Defaults pulled from your browser. Tweak anything that looks wrong."
      />
      <div className={s.field} style={{ marginTop: 24 }}>
        <label>Language</label>
        <select className={s.input} value={data.lang} onChange={(e) => set({ lang: e.target.value })}>
          {langs.map((t) => <option key={t}>{t}</option>)}
        </select>
      </div>
      <div className={s.field}>
        <label>Date format</label>
        <select className={s.input} value={data.dateFmt} onChange={(e) => set({ dateFmt: e.target.value })}>
          {dfs.map((t) => <option key={t}>{t}</option>)}
        </select>
      </div>
      <div style={{ marginTop: 18 }}>
        <label style={{ fontSize: 12, color: "var(--color-fg-mid)", fontWeight: 500, display: "block", marginBottom: 8 }}>
          Theme
        </label>
        <div className={s.themeGrid}>
          {([
            { k: "paper", n: "Paper", c: s.tpPaper },
            { k: "night", n: "Night", c: s.tpNight },
            { k: "system", n: "System", c: s.tpSys },
          ] as const).map((t) => (
            <button
              key={t.k}
              type="button"
              className={`${s.themeCard}${data.theme === t.k ? ` ${s.themeCardSel}` : ""}`}
              onClick={() => set({ theme: t.k })}
            >
              <div className={`${s.themePrev} ${t.c}`} />
              <div className={s.tn}>{t.n}</div>
            </button>
          ))}
        </div>
      </div>
      <div style={{ marginTop: 14 }}>
        <ToggleRow
          title="Show authentic verdicts"
          desc="By default, only AI-flagged items get colored badges."
          on={data.showAuth}
          onChange={(v) => set({ showAuth: v })}
        />
      </div>
    </div>
  );
}

const SAMPLES = {
  ai: "In recent years, the rapid advancement of large language models has fundamentally transformed how we approach content creation, enabling unprecedented levels of productivity across diverse industries and ushering in a new era of automated workflows.",
  human:
    "I missed the bus again. Stood there in the rain for twenty minutes before realizing the timetable had changed in March — the new one was taped over the old, slightly crooked. Took the train. Got coffee. Day continues.",
  mixed:
    "The product launch went well. Our team executed flawlessly across multiple touchpoints, leveraging cross-functional synergies to deliver a best-in-class experience. Anyway, here's what actually happened — half the demo broke, Sarah saved it, we ate cold pizza after.",
};

type SampleKey = keyof typeof SAMPLES;

type Verdict = {
  tone: "a" | "h" | "m";
  label: string;
  score: number;
  color: string;
  note: string;
  bars: Record<string, number>;
};

const TONE_TO_RING: Record<Verdict["tone"], RingTone> = {
  a: "ai",
  h: "human",
  m: "mixed",
};

const VERDICTS: Record<SampleKey, Verdict> = {
  ai: {
    tone: "a", label: "Likely AI", score: 91, color: "var(--color-ai)",
    note: "Repetitive cadence, hedge-heavy phrasing, and topic patterning consistent with GPT-class models.",
    bars: { Text: 91, Cadence: 88, Vocab: 79, Burstiness: 24 },
  },
  human: {
    tone: "h", label: "Likely Human", score: 8, color: "var(--color-human)",
    note: "Specific, asymmetric details and irregular sentence rhythm read as authored.",
    bars: { Text: 8, Cadence: 14, Vocab: 22, Burstiness: 81 },
  },
  mixed: {
    tone: "m", label: "Mixed signals", score: 54, color: "var(--color-mixed)",
    note: "Two distinct registers detected — opening reads generated, second half reads human.",
    bars: { Text: 62, Cadence: 48, Vocab: 55, Burstiness: 50 },
  },
};

function StepDemo({
  data, set, onSkip,
}: { data: OnboardingData; set: Setter; onSkip: () => void }) {
  const [tab, setTab] = useState<SampleKey>(data.demoSample);
  const [scanning, setScanning] = useState(false);
  const [verdict, setVerdict] = useState<Verdict | null>(null);

  const text = SAMPLES[tab];
  const wordCount = text.split(/\s+/).filter(Boolean).length;

  const run = () => {
    setScanning(true);
    setVerdict(null);
    setTimeout(() => {
      setVerdict(VERDICTS[tab]);
      setScanning(false);
      set({ demoRan: true, demoSample: tab });
    }, 1100);
  };

  return (
    <div className={s.step}>
      <Heading
        eyebrow="Step 05 · First scan (optional)"
        title="Try it. Pick a sample, watch a verdict."
        sub="No data leaves your browser for this one. Skip if you'd rather just get to the dashboard."
      />
      <div className={s.demoCard}>
        <div className={s.demoTabs}>
          {([
            ["ai", "AI sample"],
            ["human", "Human sample"],
            ["mixed", "Mixed sample"],
          ] as const).map(([k, n]) => (
            <button
              key={k}
              type="button"
              className={`${s.demoTab}${tab === k ? ` ${s.demoTabSel}` : ""}`}
              onClick={() => { setTab(k); setVerdict(null); }}
            >
              {n}
            </button>
          ))}
        </div>
        <div className={s.demoArea}>{text}</div>
        <div className={s.demoMeta}>
          <span>{wordCount} words · 1 sample</span>
          <span>{scanning ? "analyzing · 4 models" : verdict ? "complete" : "ready"}</span>
        </div>
        <div className={s.demoActions}>
          <button
            type="button"
            className={`${s.btn} ${s.btnCta}`}
            onClick={run}
            disabled={scanning}
            style={{ flex: 1 }}
          >
            {scanning ? "Scanning…" : verdict ? "Re-scan" : "Detect AI"}
          </button>
          <button
            type="button"
            className={`${s.btn} ${s.btnGhost}`}
            onClick={onSkip}
          >
            Skip demo →
          </button>
        </div>
        {verdict && (
          <div className={s.verdict} key={tab + verdict.score}>
            <ScoreRing
              score={verdict.score}
              tone={TONE_TO_RING[verdict.tone]}
              size={76}
            />
            <div className={s.vmeta}>
              <span className={`${s.pill} ${s["pill_" + verdict.tone]}`}>
                <span className={s.pillDot} style={{ background: verdict.color }} />
                {verdict.label}
              </span>
              <div className={s.vlbl}>Confidence based on 4 detection models in concert.</div>
              <div className={s.vnt}>{verdict.note}</div>
              <div className={s.bars}>
                {Object.entries(verdict.bars).map(([k, v]) => (
                  <div className={s.bar} key={k}>
                    <span className={s.barLb}>{k}</span>
                    <div className={s.barTrack}>
                      <i style={{ width: `${v}%`, background: verdict.color }} />
                    </div>
                    <span className={s.barVal}>{v}%</span>
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

function StepDone({
  data, onFinish, saving, error,
}: { data: OnboardingData; onFinish: () => void; saving: boolean; error: string | null }) {
  return (
    <div className={`${s.step} ${s.doneStage}`}>
      <div className={s.doneOrb}>
        <svg viewBox="0 0 24 24" aria-hidden><path d="M5 12l5 5 9-9" /></svg>
      </div>
      <h1 className={s.title} style={{ textAlign: "center" }}>
        You&apos;re all set{data.name ? `, ${data.name.split(/\s+/)[0]}` : ""}.
      </h1>
      <p className={s.sub} style={{ textAlign: "center", margin: "12px auto 0" }}>
        Your dashboard is calibrated. We&apos;re ready when you are.
      </p>
      {error && (
        <p style={{ color: "var(--color-strike, #dc2626)", marginTop: 12, fontSize: 13 }}>
          {error}
        </p>
      )}
      <button
        type="button"
        className={`${s.btn} ${s.btnCta}`}
        style={{ marginTop: 28, height: 44, padding: "0 28px", fontSize: 15 }}
        onClick={onFinish}
        disabled={saving}
      >
        {saving ? "Saving…" : "Open dashboard →"}
      </button>
    </div>
  );
}

// ── Logo ───────────────────────────────────────────────────────────
// Uses the global `.logo-word` markup from app/globals.css so the
// onboarding header's logo matches everywhere else in the app.
function Logo() {
  const [closed, setClosed] = useState(false);
  useEffect(() => {
    const t = setTimeout(() => setClosed(true), 900);
    return () => clearTimeout(t);
  }, []);
  return (
    <span
      className={`logo-word${closed ? " is-closed" : ""}`}
      aria-label="heynotai"
      style={{ fontSize: 22 }}
      onMouseEnter={() => setClosed(false)}
      onMouseLeave={() => setClosed(true)}
    >
      <span className="logo-hey">hey</span>
      <span className="logo-not"><span className="logo-not-inner">not</span></span>
      <span className="logo-ai">
        <span className="logo-strike" aria-hidden />
        ai
      </span>
    </span>
  );
}

// ── App ────────────────────────────────────────────────────────────
const STEP_LABELS = [
  "Welcome", "Role", "Use case", "Workspace",
  "First scan", "Done",
];

const TOTAL = STEP_LABELS.length;

const LANGUAGE_TO_CODE: Record<string, string> = {
  English: "en", Español: "es", Français: "fr", Deutsch: "de",
  Português: "es", "日本語": "ja",
};

function detectTimezone(): string {
  try { return Intl.DateTimeFormat().resolvedOptions().timeZone || "Europe/London"; }
  catch { return "Europe/London"; }
}

export default function OnboardingPage() {
  const router = useRouter();
  const { user, loading, refresh } = useAuth();
  const [step, setStep] = useState(0);
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);
  const [avatarFile, setAvatarFile] = useState<File | null>(null);
  const pickerRef = useRef<AvatarPickerHandle>(null);
  const initRef = useRef(false);
  const previewUrlRef = useRef<string | null>(null);

  const [data, setData] = useState<OnboardingData>({
    name: "",
    handle: "",
    handleEdited: false,
    email: "",
    avatarUrl: "",
    role: "",
    useCases: [],
    tz: "Europe/London",
    lang: "English",
    dateFmt: "24 Apr 2026",
    theme: "night",
    showAuth: false,
    connections: [],
    demoRan: false,
    demoSample: "ai",
  });
  const set: Setter = (patch) => setData((d) => ({ ...d, ...patch }));

  // Auth guard + initial seed from user record
  useEffect(() => {
    if (loading) return;
    if (!user) {
      router.replace("/?login=1&next=/app/onboarding");
      return;
    }
    if (user.onboardingCompleted) {
      router.replace("/app");
      return;
    }
    if (!initRef.current) {
      initRef.current = true;
      setData((d) => ({
        ...d,
        email: user.email,
        name: d.name || user.name || "",
        handle: d.handle || user.name?.toLowerCase().replace(/\s+/g, "") || "",
        tz: detectTimezone(),
      }));
    }
  }, [loading, user, router]);

  const isLast = step === TOTAL - 1;
  const onDoneStep = step === TOTAL - 2;

  const canAdvance = useMemo(() => {
    if (step === 0) return data.name.trim().length > 1;
    if (step === 1) return !!data.role;
    if (step === 2) return data.useCases.length > 0;
    return true;
  }, [step, data]);

  const next = () => { if (step < TOTAL - 1) setStep(step + 1); };
  const prev = () => { if (step > 0) setStep(step - 1); };
  const jump = (i: number) => { if (i <= step) setStep(i); };

  // Enter advances; Esc goes back
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Enter" && !e.shiftKey && document.activeElement?.tagName !== "TEXTAREA") {
        if (canAdvance && !isLast) {
          e.preventDefault();
          next();
        }
      }
      if (e.key === "Escape") prev();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [step, canAdvance]);

  const persist = async () => {
    if (!user) return;
    setSaving(true);
    setSaveError(null);
    try {
      // 1. user record. When the user supplied an uploaded+cropped
      // image, we send multipart FormData so PB writes it to the
      // `avatar` file field. Without a file, plain JSON is fine.
      if (avatarFile) {
        const fd = new FormData();
        fd.append("name", data.name);
        fd.append("handle", data.handle);
        fd.append("timezone", data.tz);
        fd.append("language", LANGUAGE_TO_CODE[data.lang] ?? "en");
        fd.append("role", data.role);
        fd.append("useCases", JSON.stringify(data.useCases));
        fd.append("onboardingCompleted", "true");
        fd.append("avatar", avatarFile);
        await pb.collection("users").update(user.id, fd);
      } else {
        await pb.collection("users").update(user.id, {
          name: data.name,
          handle: data.handle,
          timezone: data.tz,
          language: LANGUAGE_TO_CODE[data.lang] ?? "en",
          role: data.role,
          useCases: data.useCases,
          onboardingCompleted: true,
        });
      }

      // 2. one-row prefs collections (upsert by userId)
      await upsertPrefs("appearance_prefs", user.id, {
        theme: data.theme,
        dateFormat: data.dateFmt,
        showAuthenticVerdicts: data.showAuth,
      });
      await upsertPrefs("privacy_prefs", user.id, {
        scanRetention: "forever",
        modelTraining: false,
        anonymousAnalytics: true,
        publicProfile: true,
      });

      await refresh();
      router.replace("/app");
    } catch (err) {
      console.error("onboarding save failed", err);
      // 404 means the auth token points at a user record that no longer
      // exists — usually a stale token from before the DB was wiped.
      // Clear the session and bounce to the login modal.
      const status = (err as { status?: number } | null)?.status;
      if (status === 404 || status === 401) {
        pb.authStore.clear();
        router.replace("/?login=1&next=/app/onboarding");
        return;
      }
      setSaveError(
        err instanceof Error ? err.message : "Couldn't save your settings. Try again.",
      );
      setSaving(false);
    }
  };

  if (loading || !user || user.onboardingCompleted) {
    return null;
  }

  let stepEl: ReactNode = null;
  switch (step) {
    case 0:
      stepEl = (
        <StepWelcome
          data={data}
          set={set}
          onOpenCrop={() => pickerRef.current?.open()}
        />
      );
      break;
    case 1: stepEl = <StepRole data={data} set={set} />; break;
    case 2: stepEl = <StepUseCase data={data} set={set} />; break;
    case 3: stepEl = <StepWorkspace data={data} set={set} />; break;
    case 4: stepEl = <StepDemo data={data} set={set} onSkip={() => setStep(TOTAL - 1)} />; break;
    case 5: stepEl = <StepDone data={data} onFinish={persist} saving={saving} error={saveError} />; break;
  }

  return (
    <div className={s.body}>
      <div className={s.aurora} aria-hidden />
      <div className={s.app}>
        <header className={s.top}>
          <Logo />
          {step > 0 && step < TOTAL - 2 && (
            <button className={s.skip} onClick={() => setStep(TOTAL - 1)}>
              Skip for now →
            </button>
          )}
        </header>

        <main className={s.stage}>
          <div className={s.card}>
            <div key={`step-${step}`}>{stepEl}</div>
          </div>
        </main>

        <footer className={s.foot}>
          <div className={s.left}>
            <button
              type="button"
              className={`${s.btn} ${s.btnText}`}
              onClick={prev}
              disabled={step === 0 || isLast}
            >
              ← Back
            </button>
          </div>
          <div className={s.rail}>
            {Array.from({ length: TOTAL }, (_, i) => (
              <span key={`g-${i}`} style={{ display: "inline-flex", alignItems: "center" }}>
                <span
                  className={`${s.dot}${i < step ? ` ${s.dotDone}` : ""}${i === step ? ` ${s.dotActive}` : ""}`}
                  onClick={() => jump(i)}
                />
                {i < TOTAL - 1 && <span className={`${s.seg}${i < step ? ` ${s.segDone}` : ""}`} />}
              </span>
            ))}
          </div>
          <div className={s.right}>
            {!isLast && (
              <>
                <button
                  type="button"
                  className={`${s.btn} ${s.btnCta}`}
                  onClick={next}
                  disabled={!canAdvance}
                >
                  {onDoneStep ? "Finish" : "Continue"}
                </button>
                <span className={s.kbd}><kbd>↵</kbd></span>
              </>
            )}
          </div>
        </footer>
      </div>

      <AvatarCropModal
        ref={pickerRef}
        onConfirm={(file, previewUrl) => {
          if (previewUrlRef.current) URL.revokeObjectURL(previewUrlRef.current);
          previewUrlRef.current = previewUrl;
          setAvatarFile(file);
          set({ avatarUrl: previewUrl });
        }}
      />
    </div>
  );
}

async function upsertPrefs(
  collection: string,
  userId: string,
  fields: Record<string, unknown>,
) {
  // Try to find an existing row, then update or create.
  try {
    const existing = await pb
      .collection(collection)
      .getFirstListItem(`userId = "${userId}"`);
    await pb.collection(collection).update(existing.id, fields);
  } catch {
    await pb.collection(collection).create({ userId, ...fields });
  }
}

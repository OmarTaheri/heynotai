import type { ReactNode, SVGProps } from "react";
import { Icon, type IconName } from "./Icon";
import styles from "./HomeBelow.module.css";

/* ─────────────────────────────────────────────
   Marketing sections rendered after the LiveDemo:
     · Steps
     · FeaturesGrid
     · MarketingTestimonials
     · FAQ
     · FinalCTA
   ───────────────────────────────────────────── */

/* ── Shared eyebrow + heading rhythm ── */
function SectionHead({
  eyebrow,
  title,
  sub,
  center = false,
}: {
  eyebrow: string;
  title: ReactNode;
  sub?: ReactNode;
  center?: boolean;
}) {
  return (
    <div className={`${styles.head} ${center ? styles.headCenter : ""}`}>
      <span className={styles.eyebrow}>
        <FourPointSparkle size={11} />
        {eyebrow}
      </span>
      <h2 className={`${styles.title} ${center ? styles.titleCenter : ""}`}>
        {title}
      </h2>
      {sub && (
        <p className={`${styles.sub} ${center ? styles.subCenter : ""}`}>
          {sub}
        </p>
      )}
    </div>
  );
}

/* ─────────────────────────────────────────────
   Steps — How it works
   ───────────────────────────────────────────── */
export function Steps() {
  return (
    <section className={styles.section} id="how">
      <div className={styles.wrap}>
        <SectionHead
          eyebrow="How it works"
          title={
            <>
              Three steps. <span className={styles.dim}>No model.</span> No
              guesswork.
            </>
          }
          sub="heynotai pipes your input through four independent detectors and reconciles their verdicts. You get one answer, not four conflicting opinions."
        />
        <div className={styles.steps}>
          <div className={styles.step}>
            <div className={styles.stepNum}>Step 01 — Capture</div>
            <h3>Drop in anything</h3>
            <p>
              Paste text, drag images, attach a voice memo, link a YouTube
              video. Or let the extension watch every page you visit.
            </p>
            <div className={styles.stepVisual}>
              <div className={styles.vizDrop}>
                drop_anything.* — paste · drag · link
              </div>
            </div>
          </div>

          <div className={styles.step}>
            <div className={styles.stepNum}>Step 02 — Reconcile</div>
            <h3>Four models vote</h3>
            <p>
              Each surface runs its own ensemble — language model heads for
              text, vision transformers for images, spectral and prosody
              analysis for audio.
            </p>
            <div className={styles.stepVisual}>
              <div className={styles.vizModels}>
                <span className={styles.vizChip}>gpt-detect</span>
                <span className={styles.vizChip}>vit-forensic</span>
                <span className={styles.vizChip}>tts-match</span>
                <span className={styles.vizChip}>facial-flow</span>
              </div>
            </div>
          </div>

          <div className={styles.step}>
            <div className={styles.stepNum}>Step 03 — Verdict</div>
            <h3>One honest answer</h3>
            <p>
              Likely human, likely AI, or uncertain — with a probability you
              can argue with. Never &ldquo;yes/no&rdquo;, never an emoji,
              never made up.
            </p>
            <div className={styles.stepVisual}>
              <div className={styles.vizVerdicts}>
                <Verdict kind="human">Human</Verdict>
                <Verdict kind="ai">AI</Verdict>
                <Verdict kind="mixed">Mixed</Verdict>
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}

/* ─────────────────────────────────────────────
   Features grid
   ───────────────────────────────────────────── */
type FeatureItem = {
  icon: IconName | "graph";
  title: string;
  body: string;
  meta: string;
};

const FEATURES: FeatureItem[] = [
  {
    icon: "puzzle",
    title: "Browser extension",
    body: "A colored trust border draws around any YouTube player in real time. Click for the full verdict.",
    meta: "Chrome MV3 · Edge · Brave",
  },
  {
    icon: "globe",
    title: "Works on any page",
    body: "Text fields, image previews, embedded videos — heynotai watches the DOM and verifies in place.",
    meta: "1.4M sites compatible",
  },
  {
    icon: "graph",
    title: "Reports you can defend",
    body: "Every verdict ships with the model breakdown, the flagged regions, and the confidence interval. Export as PDF.",
    meta: "Audit trail · API access",
  },
  {
    icon: "lock",
    title: "Privacy-first",
    body: "Nothing leaves your device unless you ask. The browser extension runs locally; the API is opt-in.",
    meta: "On-device · zero retention",
  },
  {
    icon: "shield",
    title: "Honest about uncertainty",
    body: "Three verdicts: likely human, likely AI, uncertain. Never a fake 100%, never a hallucinated reason.",
    meta: "Probabilistic by design",
  },
  {
    icon: "cube",
    title: "Eight detectors, one API",
    body: "Text, image, audio, video, deepfake, voice clone, watermark, paraphrase. One auth, one bill.",
    meta: "REST + WebSocket",
  },
];

export function FeaturesGrid() {
  return (
    <section className={styles.section} id="features">
      <div className={styles.wrap}>
        <SectionHead
          center
          eyebrow="Features"
          title={
            <>
              <span className={styles.dim}>Built like</span> a forensics lab.
            </>
          }
          sub="Every part of the product is designed to give you a verdict you can stand behind in a meeting, a classroom, or a courtroom."
        />
        <div className={styles.features}>
          {FEATURES.map((f) => (
            <div key={f.title} className={styles.feature}>
              <div className={styles.featureIcon}>
                {f.icon === "graph" ? (
                  <GraphIcon size={20} />
                ) : (
                  <Icon name={f.icon} size={20} />
                )}
              </div>
              <h4>{f.title}</h4>
              <p>{f.body}</p>
              <div className={styles.featureMeta}>{f.meta}</div>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}

/* ─────────────────────────────────────────────
   Testimonials
   ───────────────────────────────────────────── */
type Tone = "a" | "b" | "c";
const TONE_CLASS: Record<Tone, string> = {
  a: styles.testAvA,
  b: styles.testAvB,
  c: styles.testAvC,
};

const TESTS: { quote: string; name: string; role: string; tone: Tone; letters: string }[] = [
  {
    quote:
      "We caught seventeen AI-written cover letters in a single morning. Two months ago we wouldn't have caught any. heynotai is now the first thing every reviewer opens.",
    name: "Priya Mehta",
    role: "Head of Talent · Veritas HR",
    tone: "a",
    letters: "PM",
  },
  {
    quote:
      "I read the regional flags on a student's essay before I read the essay itself. It's not a verdict on the student — it's a starting point for a conversation.",
    name: "Daniel Okafor",
    role: "English Faculty · Falcon Edu",
    tone: "b",
    letters: "DO",
  },
  {
    quote:
      "The trust border on YouTube has changed how my team reviews source video. We can tell at a glance whether to dig in or move on.",
    name: "Hana Reyes",
    role: "Investigations Editor · Atlas Media",
    tone: "c",
    letters: "HR",
  },
];

export function MarketingTestimonials() {
  return (
    <section className={styles.section} id="testimonials">
      <div className={styles.wrap}>
        <SectionHead
          center
          eyebrow="Customers"
          title={
            <>
              What teams say{" "}
              <span className={styles.dim}>after a week.</span>
            </>
          }
        />
        <div className={styles.tests}>
          {TESTS.map((t) => (
            <div key={t.name} className={styles.test}>
              <p className={styles.testQuote}>{t.quote}</p>
              <div className={styles.testWho}>
                <div className={`${styles.testAv} ${TONE_CLASS[t.tone]}`}>
                  {t.letters}
                </div>
                <div>
                  <div className={styles.testName}>{t.name}</div>
                  <div className={styles.testRole}>{t.role}</div>
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}

/* ─────────────────────────────────────────────
   FAQ
   ───────────────────────────────────────────── */
const FAQS: { q: string; a: string }[] = [
  {
    q: "How accurate is heynotai?",
    a: "Across our internal benchmark of 40 000 mixed samples, the four-model ensemble lands at 96.3% on text, 94.1% on image, 91.7% on audio, and 89.4% on video. We publish the confusion matrix and a probability for every verdict — never a false 100%.",
  },
  {
    q: "Will it flag my own writing as AI?",
    a: "Sometimes — particularly for highly-formal academic prose, where humans and language models converge in style. That's why every verdict comes with a probability and the underlying model votes. The product is a starting point for a conversation, not a binary judgment.",
  },
  {
    q: "Does it work offline?",
    a: "The browser extension runs on-device for text and image checks. Audio and video analysis use the API — opt-in only, with zero retention by default. You can self-host the API if you need an air-gapped deployment.",
  },
  {
    q: "What about students and teachers?",
    a: "We license heynotai for education at a flat per-seat rate, with regional flags rather than scores so teachers can see which paragraphs warrant a follow-up. We do not surface a 'cheating' verdict — that's a conversation for the classroom.",
  },
  {
    q: "How do you handle false positives?",
    a: "Every verdict can be appealed in-product; the appeal goes back into our re-training pipeline (with consent). Customers on the team plan get a private retrieval index so their own content style isn't flagged repeatedly.",
  },
];

export function FAQ() {
  return (
    <section className={styles.section} id="faq">
      <div className={styles.wrapNarrow}>
        <SectionHead
          center
          eyebrow="FAQ"
          title={
            <>
              Questions,{" "}
              <span className={styles.dim}>honestly answered.</span>
            </>
          }
        />
        <div className={styles.faq}>
          {FAQS.map((f, i) => (
            <details key={f.q} {...(i === 0 ? { open: true } : {})}>
              <summary>
                {f.q}
                <span className={styles.faqChev}>
                  <Icon name="plus" size={10} />
                </span>
              </summary>
              <div className={styles.faqBody}>{f.a}</div>
            </details>
          ))}
        </div>
      </div>
    </section>
  );
}

/* ─────────────────────────────────────────────
   Final CTA strip
   ───────────────────────────────────────────── */
export function FinalCTA() {
  return (
    <section className={`${styles.section} ${styles.compact}`}>
      <div className={styles.wrap}>
        <div className={styles.ctaStrip}>
          <h2>
            Catch AI{" "}
            <span className={styles.ctaStripDim}>before it</span> catches
            you.
          </h2>
          <p>
            Add the extension in under a minute. Free for the first 500
            detections each month — no card, no model, no guesswork.
          </p>
          <div className={styles.ctaActions}>
            <a className={`${styles.pill} ${styles.pillCta}`} href="#">
              <ChromeIcon size={14} /> Add to Chrome — free
            </a>
            <a className={`${styles.pill} ${styles.pillGhost}`} href="#">
              Talk to sales <ExternalIcon size={13} />
            </a>
          </div>
        </div>
      </div>
    </section>
  );
}

/* ─────────────────────────────────────────────
   Local primitives
   ───────────────────────────────────────────── */
function Verdict({
  kind,
  children,
}: {
  kind: "ai" | "human" | "mixed";
  children: ReactNode;
}) {
  const cls =
    kind === "ai"
      ? styles.verdictAi
      : kind === "human"
        ? styles.verdictHuman
        : styles.verdictMixed;
  return (
    <span className={`${styles.verdict} ${cls}`}>
      <span className={styles.verdictDot} />
      {children}
    </span>
  );
}

function FourPointSparkle({ size = 11 }: { size?: number }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="currentColor"
      aria-hidden
    >
      <path d="M12 2C12 8 16 12 22 12C16 12 12 16 12 22C12 16 8 12 2 12C8 12 12 8 12 2Z" />
    </svg>
  );
}

/* Icons missing from the central Icon set: a small graph (Features card),
   a Chrome glyph (Add to Chrome CTA), and an external-link arrow (sales
   CTA). Inlined here rather than added to the shared set since they're
   only used by this surface. */
function GraphIcon({ size = 20, ...rest }: { size?: number } & SVGProps<SVGSVGElement>) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={1.8}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden
      {...rest}
    >
      <path d="M3 19h18M5 16l4-5 4 3 6-8" />
    </svg>
  );
}

function ChromeIcon({ size = 14, ...rest }: { size?: number } & SVGProps<SVGSVGElement>) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={1.8}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden
      {...rest}
    >
      <circle cx="12" cy="12" r="9" />
      <circle cx="12" cy="12" r="3.5" />
      <path d="M12 8.5h7.5M8.7 13.6 4.7 7M15.3 13.6 11 21" />
    </svg>
  );
}

function ExternalIcon({ size = 13, ...rest }: { size?: number } & SVGProps<SVGSVGElement>) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={1.8}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden
      {...rest}
    >
      <path d="M14 4h6v6M10 14 20 4M19 14v6H4V5h6" />
    </svg>
  );
}

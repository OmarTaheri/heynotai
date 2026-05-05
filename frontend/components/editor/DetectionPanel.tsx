"use client";

import { useEffect, useId, useLayoutEffect, useRef, useState } from "react";
import { Icon } from "@/components/Icon";
import { Pill } from "@/components/ui/Pill";
import type { ScanState } from "@/components/editor-shell";
import type { ScanResult } from "@/lib/detection-types";
import { ENGINES, type Engine, type EngineType } from "@/lib/models-data";
import { VerdictCard } from "./VerdictCard";
import { FindingCard } from "./FindingCard";
import { DeepScanCta } from "./DeepScanCta";
import styles from "./DetectionPanel.module.css";

function findEngine(id: string, engines: Engine[]): Engine {
  return engines.find((e) => e.id === id) ?? engines[0];
}

// HF detectors return noisy garbage on very short inputs. We block the
// scan client-side below this floor and surface a "X / 50 words" hint.
export const MIN_SCAN_WORDS = 50;

type TabKey = "analyzer" | "findings" | "plag";
type PlagState = "locked" | "scanning" | "done";

interface PlagSource {
  url: string;
  title: string;
  similarity: number;
  quote: string;
}

interface Props {
  scanState: ScanState;
  result: ScanResult | null;
  /** Populated when the backend marked the scan as failed. The Verdict
   *  tab swaps in an error card instead of inventing a fake authenticity. */
  scanError?: { code?: string; message?: string; status?: number } | null;
  selectedId: string | null;
  onSelect: (id: string) => void;
  /** Engine the user currently has selected in the panel. */
  engineId: string;
  onEngineChange: (id: string) => void;
  /** Engine the current `result` was actually scanned with. */
  appliedEngineId: string;
  /** Re-run the scan with `engineId` (also updates `appliedEngineId`). */
  onRetest: () => void;
  /** Per-flag excerpt strings for the Findings tab (keyed by flag id). */
  excerpts?: Record<string, string>;
  /** Current document word count. Used to gate the verdict/findings tabs
   *  with a "text is too short" hint when below MIN_SCAN_WORDS. */
  wordCount?: number;
  /** Which engine catalog to expose in the model picker. Defaults to text. */
  contentType?: EngineType;
  /** "full" shows tabs (analyzer/findings/plag); "analyzer" shows only the verdict. */
  mode?: "full" | "analyzer";
}

export function DetectionPanel({
  scanState,
  result,
  scanError,
  selectedId,
  onSelect,
  engineId,
  onEngineChange,
  appliedEngineId,
  onRetest,
  excerpts,
  wordCount,
  contentType = "txt",
  mode = "full",
}: Props) {
  const engines = ENGINES[contentType];
  const analyzerOnly = mode === "analyzer";
  const [activeTab, setActiveTab] = useState<TabKey>("analyzer");
  const [plagState, setPlagState] = useState<PlagState>("locked");
  const [plagSources, setPlagSources] = useState<PlagSource[]>([]);
  const plagTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const visibleFlags = result?.flags ?? [];
  const engineDirty = engineId !== appliedEngineId;
  const plagScanning = plagState === "scanning";
  const effectiveTab: TabKey = analyzerOnly ? "analyzer" : activeTab;

  // Reset the plagiarism state whenever a fresh primary scan kicks off.
  // The deep scan is only meaningful for the current document state.
  useEffect(() => {
    if (scanState === "scanning") {
      setPlagState("locked");
      setPlagSources([]);
      if (plagTimerRef.current) {
        clearTimeout(plagTimerRef.current);
        plagTimerRef.current = null;
      }
    }
  }, [scanState]);

  useEffect(
    () => () => {
      if (plagTimerRef.current) clearTimeout(plagTimerRef.current);
    },
    [],
  );

  const startDeepScan = () => {
    if (plagScanning) return;
    setActiveTab("plag");
    setPlagState("scanning");
    setPlagSources([]);
    plagTimerRef.current = setTimeout(() => {
      setPlagSources(MOCK_PLAG_SOURCES);
      setPlagState("done");
      plagTimerRef.current = null;
    }, 1800);
  };

  const handleTabClick = (key: TabKey) => {
    setActiveTab(key);
  };

  const headerCopy = HEADER_COPY[effectiveTab];

  return (
    <div className={styles.scroll}>
      <div className={styles.body}>
        {!analyzerOnly && (
          <Tabs
            active={activeTab}
            onChange={handleTabClick}
            plagScanning={plagScanning}
            findingsCount={result?.flags.length ?? 0}
          />
        )}

        <header className={styles.header}>
          <h2 className={styles.title}>
            {headerCopy.lead} <em>{headerCopy.emph}</em>
          </h2>
          <button type="button" className={styles.help} aria-label="Help">
            <Icon name="info" size={14} />
          </button>
        </header>

        {effectiveTab === "analyzer" && (
          <VerdictTab
            scanState={scanState}
            result={result}
            scanError={scanError ?? null}
            plagScanning={plagScanning}
            onDeepScan={startDeepScan}
            onRetest={onRetest}
            showDeepScan={!analyzerOnly}
            wordCount={wordCount}
          />
        )}

        {!analyzerOnly && effectiveTab === "findings" && (
          <FindingsTab
            scanState={scanState}
            flags={visibleFlags}
            selectedId={selectedId}
            onSelect={onSelect}
            excerpts={excerpts}
            wordCount={wordCount}
            hasResult={!!result}
          />
        )}

        {/* wordCount is text-only — image/audio/video panels omit it. */}

        {!analyzerOnly && effectiveTab === "plag" && (
          <PlagTab
            plagState={plagState}
            sources={plagSources}
            onDeepScan={startDeepScan}
          />
        )}
      </div>

      <div className={styles.footer}>
        <EngineSelector
          engineId={engineId}
          onChange={onEngineChange}
          dirty={engineDirty}
          onRetest={onRetest}
          scanning={scanState === "scanning"}
          engines={engines}
        />
      </div>
    </div>
  );
}

const HEADER_COPY: Record<TabKey, { lead: string; emph: string }> = {
  analyzer: { lead: "AI", emph: "analyzer" },
  findings: { lead: "Detection", emph: "findings" },
  plag: { lead: "Plagiarism", emph: "scan" },
};

/* ------------------------------------------------------------------ */
/* Tabs                                                                */
/* ------------------------------------------------------------------ */

function Tabs({
  active,
  onChange,
  plagScanning,
  findingsCount,
}: {
  active: TabKey;
  onChange: (key: TabKey) => void;
  plagScanning: boolean;
  findingsCount: number;
}) {
  const items: Array<{
    key: TabKey;
    label: string;
    count?: number;
    busy?: boolean;
    locked?: boolean;
    lockedHint?: string;
  }> = [
    { key: "analyzer", label: "Analyzer" },
    // Per-span findings are gated until we ship a token-classification
    // model — current HF detectors only produce a whole-document verdict.
    {
      key: "findings",
      label: "Findings",
      count: findingsCount,
      locked: true,
      lockedHint: "Per-sentence findings — coming soon",
    },
    // Plagiarism deep scan isn't built yet — keep the tab visible as a
    // teaser but render it locked everywhere it surfaces.
    {
      key: "plag",
      label: "Plagiarism",
      busy: plagScanning,
      locked: true,
      lockedHint: "Plagiarism deep scan — coming soon",
    },
  ];

  return (
    <div className={styles.tabs} role="tablist" aria-label="AI analyzer view">
      {items.map((item) => {
        const isActive = active === item.key;
        return (
          <button
            key={item.key}
            type="button"
            role="tab"
            aria-selected={isActive}
            className={`${styles.tab}${isActive ? ` ${styles.tabActive}` : ""}`}
            onClick={() => onChange(item.key)}
            title={item.lockedHint}
          >
            {item.busy && <span className={styles.tabSpinner} aria-hidden />}
            <span>{item.label}</span>
            {item.locked && <Icon name="lock" size={11} />}
            {typeof item.count === "number" && item.count > 0 && (
              <span className={styles.tabBadge}>{item.count}</span>
            )}
          </button>
        );
      })}
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* Verdict tab                                                         */
/* ------------------------------------------------------------------ */

function VerdictTab({
  scanState,
  result,
  scanError,
  plagScanning,
  onDeepScan,
  onRetest,
  showDeepScan = true,
  wordCount,
}: {
  scanState: ScanState;
  result: ScanResult | null;
  scanError: { code?: string; message?: string; status?: number } | null;
  plagScanning: boolean;
  onDeepScan: () => void;
  onRetest: () => void;
  showDeepScan?: boolean;
  wordCount?: number;
}) {
  // Gate before the scanState ladder, but only when there's no cached
  // verdict — if the user already scanned and then trimmed text we want
  // to keep the prior verdict visible rather than wipe it. The gate is
  // opt-in: image/audio/video panels don't pass a wordCount.
  if (!result && typeof wordCount === "number" && wordCount < MIN_SCAN_WORDS) {
    return <TooShortState wordCount={wordCount} />;
  }
  if (scanState === "idle") return <IdleState />;
  if (scanState === "scanning") return <VerdictSkeleton />;
  if (scanState === "failed") return <FailedState error={scanError} onRetest={onRetest} />;
  // No cached result for the currently-selected engine — the user just
  // switched the model picker to one they haven't tested yet on this
  // scan. Surface a "Run scan" CTA, not the failure UI.
  if (!result) return <UntestedState onRetest={onRetest} />;
  return (
    <>
      <VerdictCard result={result} />
      {showDeepScan && <DeepScanCta onClick={onDeepScan} scanning={plagScanning} locked />}
    </>
  );
}

function TooShortState({ wordCount }: { wordCount: number }) {
  const need = Math.max(0, MIN_SCAN_WORDS - wordCount);
  return (
    <div className={styles.empty}>
      <div className={styles.emptyIcon}>
        <Icon name="text" size={20} />
      </div>
      <div className={styles.emptyTitle}>Text is too short to scan</div>
      <div className={styles.emptySub}>
        Add <strong>{need}</strong> more word{need === 1 ? "" : "s"} — we need
        at least {MIN_SCAN_WORDS} for a reliable verdict.
      </div>
      <div className={styles.emptySub} style={{ marginTop: 4 }}>
        {wordCount} / {MIN_SCAN_WORDS} words
      </div>
    </div>
  );
}

function UntestedState({ onRetest }: { onRetest: () => void }) {
  return (
    <div className={styles.empty}>
      <div className={styles.emptyIcon}>
        <Icon name="bolt" size={20} />
      </div>
      <div className={styles.emptyTitle}>Not tested with this model yet</div>
      <div className={styles.emptySub}>
        Run the selected detector to see its verdict for this scan.
      </div>
      <button type="button" className={styles.retestBtn} onClick={onRetest}>
        <Icon name="refresh" size={12} />
        Run scan
      </button>
    </div>
  );
}

function FailedState({
  error,
  onRetest,
}: {
  error: { code?: string; message?: string; status?: number } | null;
  onRetest: () => void;
}) {
  const message = error?.message || "Detection failed.";
  const tag =
    error?.code === "provider_error"
      ? `Hugging Face ${error.status ?? ""}`.trim()
      : error?.code === "internal_error"
        ? "Internal error"
        : "Error";
  // HF returns this exact phrase when a model isn't on the free
  // serverless tier (audio classification, niche models, etc.). Add a
  // hint so the user doesn't think the system is broken.
  const isUnsupportedModel = /not supported by provider/i.test(message);
  return (
    <div className={styles.empty}>
      <div className={styles.emptyIcon}>
        <Icon name="alert-triangle" size={20} />
      </div>
      <div className={styles.emptyTitle}>Scan failed</div>
      <div className={styles.emptySub}>
        <strong>{tag}:</strong> {message}
      </div>
      {isUnsupportedModel && (
        <div className={styles.emptySub} style={{ marginTop: 4 }}>
          Pick a different model in the dropdown below — this one isn&rsquo;t
          on Hugging Face&rsquo;s free tier.
        </div>
      )}
      <button type="button" className={styles.retestBtn} onClick={onRetest}>
        <Icon name="refresh" size={12} />
        Try again
      </button>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* Findings tab                                                        */
/* ------------------------------------------------------------------ */

function FindingsTab({
  scanState,
  flags,
  selectedId,
  onSelect,
  excerpts,
  wordCount,
  hasResult,
}: {
  scanState: ScanState;
  flags: ScanResult["flags"];
  selectedId: string | null;
  onSelect: (id: string) => void;
  excerpts?: Record<string, string>;
  wordCount?: number;
  hasResult: boolean;
}) {
  if (!hasResult && typeof wordCount === "number" && wordCount < MIN_SCAN_WORDS) {
    return <TooShortState wordCount={wordCount} />;
  }
  if (scanState === "idle") return <IdleState />;
  if (scanState === "scanning") return <FindingsSkeleton />;
  if (flags.length === 0) {
    // The current HF text/image/audio detectors only produce a single
    // whole-document verdict — no per-sentence span scores. Show a
    // locked empty state so users understand the feature is coming.
    return (
      <div className={styles.empty}>
        <div className={styles.emptyIcon}>
          <Icon name="lock" size={20} />
        </div>
        <div className={styles.emptyTitle}>Per-sentence findings — coming soon</div>
        <div className={styles.emptySub}>
          Today&rsquo;s models give a whole-document verdict (see the
          Analyzer tab). Span-level highlighting is on the roadmap.
        </div>
      </div>
    );
  }
  return (
    <div className={styles.findings}>
      {flags.map((flag) => (
        <FindingCard
          key={flag.id}
          flag={flag}
          active={selectedId === flag.id}
          onClick={() => onSelect(flag.id)}
          excerpt={excerpts?.[flag.id]}
        />
      ))}
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* Plagiarism tab                                                      */
/* ------------------------------------------------------------------ */

function PlagTab({
  plagState,
  sources,
  onDeepScan,
}: {
  plagState: PlagState;
  sources: PlagSource[];
  onDeepScan: () => void;
}) {
  if (plagState === "locked") {
    return (
      <div className={styles.empty}>
        <div className={styles.emptyIcon}>
          <Icon name="lock" size={20} />
        </div>
        <div className={styles.emptyTitle}>Plagiarism scan — coming soon</div>
        <div className={styles.emptySub}>
          We&rsquo;re still wiring up the web + academic index pipeline.
          Deep scan will land in a future release.
        </div>
        <DeepScanCta onClick={onDeepScan} locked />
      </div>
    );
  }
  if (plagState === "scanning") return <PlagScanningState />;
  if (sources.length === 0) {
    return (
      <div className={styles.empty}>
        <div className={styles.emptyTitle}>No matches found</div>
        <div className={styles.emptySub}>
          We searched web + academic indexes — nothing notable came back.
        </div>
      </div>
    );
  }
  return (
    <div className={styles.plagList}>
      {sources.map((s) => (
        <article key={s.url} className={styles.plagSource}>
          <header className={styles.plagSourceHead}>
            <span className={styles.plagSimPct}>{s.similarity}%</span>
            <span className={styles.plagSourceTitle}>{s.title}</span>
          </header>
          <a
            className={styles.plagSourceUrl}
            href={s.url}
            target="_blank"
            rel="noopener noreferrer"
          >
            {s.url}
          </a>
          <blockquote className={styles.plagSourceQuote}>{s.quote}</blockquote>
        </article>
      ))}
    </div>
  );
}

function PlagScanningState() {
  return (
    <div className={styles.plagScan} role="status" aria-live="polite">
      <div className={styles.plagScanHead}>
        <span className={styles.plagSpinner} aria-hidden />
        <div>
          <div className={styles.plagScanTitle}>
            Searching web + academic indexes
          </div>
          <div className={styles.plagScanSub}>
            Comparing passages against ~4B documents
          </div>
        </div>
      </div>
      <ol className={styles.plagSteps}>
        <li className={styles.plagStepDone}>
          <Icon name="check" size={11} />
          Tokenizing document
        </li>
        <li className={styles.plagStepActive}>
          <span className={styles.plagStepDot} />
          Querying web index
        </li>
        <li>
          <span className={styles.plagStepDot} />
          Querying academic index
        </li>
        <li>
          <span className={styles.plagStepDot} />
          Ranking matches
        </li>
      </ol>
    </div>
  );
}

const MOCK_PLAG_SOURCES: PlagSource[] = [
  {
    url: "https://en.wikipedia.org/wiki/Large_language_model",
    title: "Large language model — Wikipedia",
    similarity: 32,
    quote:
      "A large language model is a type of language model notable for its ability to achieve general-purpose language understanding and generation.",
  },
  {
    url: "https://arxiv.org/abs/2303.18223",
    title: "A Survey of Large Language Models — arXiv",
    similarity: 18,
    quote:
      "Recent progress on large language models has been driven by scaling laws across data, compute, and parameters.",
  },
];

/* ------------------------------------------------------------------ */
/* Engine selector + dropdown                                          */
/* ------------------------------------------------------------------ */

function EngineSelector({
  engineId,
  onChange,
  dirty,
  onRetest,
  scanning,
  engines,
}: {
  engineId: string;
  onChange: (id: string) => void;
  dirty: boolean;
  onRetest: () => void;
  scanning: boolean;
  engines: Engine[];
}) {
  const engine = findEngine(engineId, engines);
  const isPowerful = engine.accuracy >= 92;
  const showRetest = dirty && !scanning;

  return (
    <section className={styles.engineCard} aria-label="Detection engine">
      <div className={styles.engineMain}>
        <div className={styles.engineHead}>
          <span className={styles.engineLabel}>Detection engine</span>
          {isPowerful && (
            <Pill tone="info" compact>
              <Icon name="bolt" size={9} />
              POWERFUL
            </Pill>
          )}
        </div>
        <div className={styles.engineName}>
          <span className={styles.engineNameText}>{engine.name}</span>
          {engine.version && (
            <em className={styles.engineVersion}> {engine.version}</em>
          )}
        </div>
        <div className={styles.engineSpecs}>
          <span className={styles.spec}>
            <span
              className={`${styles.specValue}${
                engine.accuracy < 90 ? ` ${styles.specWarn}` : ""
              }`}
            >
              {engine.accuracy}
              <span className={styles.specUnit}>%</span>
            </span>
            <span className={styles.specLabel}>Accuracy</span>
          </span>
          <span className={styles.specDot} aria-hidden />
          <span className={styles.spec}>
            <span
              className={`${styles.specValue}${
                engine.cost.tone === "free" ? ` ${styles.specFree}` : ""
              }${engine.cost.tone === "high" ? ` ${styles.specHigh}` : ""}`}
            >
              {engine.cost.value}
              <span className={styles.specUnit}>tk</span>
            </span>
            <span className={styles.specLabel}>{engine.cost.unit}</span>
          </span>
        </div>
      </div>

      <div className={styles.engineActions}>
        <ModelPicker value={engineId} onChange={onChange} engines={engines} />
        {showRetest && (
          <button type="button" className={styles.retestBtn} onClick={onRetest}>
            <Icon name="refresh" size={12} />
            Test again
          </button>
        )}
      </div>
    </section>
  );
}

function ModelPicker({
  value,
  onChange,
  engines,
}: {
  value: string;
  onChange: (id: string) => void;
  engines: Engine[];
}) {
  const [open, setOpen] = useState(false);
  const [direction, setDirection] = useState<"down" | "up">("down");
  const wrapRef = useRef<HTMLDivElement>(null);
  const btnRef = useRef<HTMLButtonElement>(null);
  const labelId = useId();
  const current = findEngine(value, engines);

  useEffect(() => {
    if (!open) return;
    const onDoc = (e: MouseEvent) => {
      if (!wrapRef.current?.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener("mousedown", onDoc);
    return () => document.removeEventListener("mousedown", onDoc);
  }, [open]);

  // When the menu opens, decide whether to drop down or up based on the
  // available viewport space below the trigger. The engine selector lives
  // at the bottom of the inspector, so "down" usually clips.
  useLayoutEffect(() => {
    if (!open) return;
    const btn = btnRef.current;
    if (!btn) return;
    const rect = btn.getBoundingClientRect();
    const estimatedMenuHeight = Math.min(280, engines.length * 44 + 12);
    const spaceBelow = window.innerHeight - rect.bottom;
    const spaceAbove = rect.top;
    if (spaceBelow < estimatedMenuHeight && spaceAbove > spaceBelow) {
      setDirection("up");
    } else {
      setDirection("down");
    }
  }, [open, engines.length]);

  return (
    <div ref={wrapRef} className={styles.picker}>
      <span id={labelId} className={styles.pickerLabel}>
        Try another model
      </span>
      <button
        ref={btnRef}
        type="button"
        className={styles.pickerBtn}
        aria-haspopup="listbox"
        aria-expanded={open}
        aria-labelledby={labelId}
        onClick={() => setOpen((v) => !v)}
      >
        <span className={styles.pickerCurrent}>
          {current.name}
          {current.version && (
            <em className={styles.engineVersion}> {current.version}</em>
          )}
        </span>
        <Icon name="chevron-down" size={12} />
      </button>

      {open && (
        <ul
          className={`${styles.menu}${direction === "up" ? ` ${styles.menuUp}` : ""}`}
          role="listbox"
          aria-labelledby={labelId}
        >
          {engines.map((eng) => {
            const selected = eng.id === value;
            const locked = !!eng.locked;
            return (
              <li key={eng.id}>
                <button
                  type="button"
                  role="option"
                  aria-selected={selected}
                  aria-disabled={locked}
                  className={`${styles.menuItem}${
                    selected ? ` ${styles.menuItemSelected}` : ""
                  }${locked ? ` ${styles.menuItemLocked}` : ""}`}
                  onClick={() => {
                    if (locked) return;
                    onChange(eng.id);
                    setOpen(false);
                  }}
                >
                  <span className={styles.menuItemName}>
                    {eng.name}
                    {eng.version && (
                      <em className={styles.engineVersion}> {eng.version}</em>
                    )}
                    {locked && <Icon name="lock" size={10} />}
                  </span>
                  <span className={styles.menuItemMeta}>
                    <span>{eng.accuracy}%</span>
                    <span className={styles.menuItemDot}>·</span>
                    <span>{eng.cost.value} tk</span>
                  </span>
                </button>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* Skeletons + empty states                                            */
/* ------------------------------------------------------------------ */

/**
 * Verdict-tab skeleton. Mirrors the AI-only layout the real card uses
 * for HF-driven scans: ring + verdict header + a single AI-generated
 * bar. The card itself lights up additional rows (match/plag/stats)
 * only when the underlying data exists, so the skeleton must not
 * promise rows that won't appear.
 */
function VerdictSkeleton() {
  return (
    <article
      className={`${styles.verdictSkeleton}`}
      role="status"
      aria-live="polite"
    >
      <div className={styles.vsTop}>
        <div className={styles.vsRing}>
          <span className={styles.vsRingDigits} />
        </div>
        <div className={styles.vsTopText}>
          <div className={styles.vsHead}>
            Likely <em className={styles.vsHeadDim}>—</em>
          </div>
          <div className={styles.vsSub}>
            <span className={styles.vsInline} /> detection
          </div>
        </div>
      </div>

      <div className={styles.vsBarRow}>
        <span className={styles.vsBarLbl}>AI-generated</span>
        <span className={styles.vsBarTrack}>
          <span className={`${styles.vsBarFill} ${styles.barFillGen}`} />
        </span>
        <span className={styles.vsBarPct} />
      </div>
    </article>
  );
}

function FindingsSkeleton() {
  return (
    <div className={styles.findingsSk}>
      {[0, 1, 2].map((i) => (
        <div key={i} className={styles.findingSk}>
          <div className={styles.findingSkHead}>
            <span className={styles.findingSkTag} />
            <span className={styles.findingSkConf} />
          </div>
          <span className={styles.findingSkLineLg} />
          <span className={styles.findingSkLineMd} />
          <span className={styles.findingSkLineSm} />
        </div>
      ))}
    </div>
  );
}

function IdleState() {
  return (
    <div className={styles.empty}>
      <div className={styles.emptyTitle}>Nothing to detect yet</div>
      <div className={styles.emptySub}>
        Paste or write content in the editor — we&rsquo;ll scan it as you go.
      </div>
    </div>
  );
}

"use client";

import { useState } from "react";
import type { AiFlag, FlagKind, ScanResult } from "@/lib/detection-types";

type Tab = "detect" | "generate" | "plagiarism";
type CategoryFilter = "all" | FlagKind;

interface Props {
  scanState: "idle" | "scanning" | "done";
  result: ScanResult | null;
  selectedId: string | null;
  onSelect: (id: string) => void;
}

/**
 * Right-side AI-detection panel for the /editor page. Mirrors the
 * structure of the extension's drawer (Header / Tabs / scrollable body
 * / footer CTA) but uses the frontend's dark token palette throughout.
 */
export function DetectionPanel({ scanState, result, selectedId, onSelect }: Props) {
  const [tab, setTab] = useState<Tab>("detect");
  const [filter, setFilter] = useState<CategoryFilter>("all");

  return (
    <aside className="detection-panel">
      <header className="dp-tabs" role="tablist">
        <PanelTab active={tab === "detect"} onClick={() => setTab("detect")} icon={<ShieldIcon />} label="AI detection" />
        <PanelTab active={tab === "generate"} onClick={() => setTab("generate")} icon={<SparkleIcon />} label="Generative" />
        <PanelTab active={tab === "plagiarism"} onClick={() => setTab("plagiarism")} icon={<QuoteIcon />} label="Plagiarism" />
      </header>

      <div className="dp-section-head">
        <div className="dp-title-row">
          <h2 className="dp-title">
            AI <em>detection</em>
          </h2>
          <button className="dp-help" aria-label="What's this?" type="button">?</button>
        </div>

        <div className="dp-chips" role="tablist" aria-label="Category">
          <CategoryChip active={filter === "gen"} onClick={() => setFilter(filter === "gen" ? "all" : "gen")} kind="gen" label="AI-generated" />
          <CategoryChip active={filter === "match"} onClick={() => setFilter(filter === "match" ? "all" : "match")} kind="match" label="Model match" />
          <CategoryChip active={filter === "plag"} onClick={() => setFilter(filter === "plag" ? "all" : "plag")} kind="plag" label="Plagiarism" />
        </div>
      </div>

      <div className="dp-body">
        {scanState === "scanning" && <ScanningSkeleton />}

        {scanState === "done" && result && (
          <>
            <ScoreCard result={result} />
            {result.flags
              .filter((f) => filter === "all" || f.kind === filter)
              .map((flag) => (
                <SuggestionCard
                  key={flag.id}
                  flag={flag}
                  active={selectedId === flag.id}
                  onClick={() => onSelect(flag.id)}
                />
              ))}
            {result.flags.length === 0 && <EmptyState />}
          </>
        )}

        {scanState === "idle" && <IdleState />}
      </div>

      <button className="dp-foot" type="button">
        <span className="dp-foot-icon"><SparkleIcon /></span>
        <span className="dp-foot-info">
          <span className="dp-foot-title">Run <em>deep authenticity scan</em></span>
          <span className="dp-foot-sub">All engines · 14 tokens · Pro</span>
        </span>
        <span className="dp-foot-arrow"><ChevronRightIcon /></span>
      </button>
    </aside>
  );
}

function PanelTab({
  active,
  onClick,
  icon,
  label,
}: {
  active: boolean;
  onClick: () => void;
  icon: React.ReactNode;
  label: string;
}) {
  return (
    <button
      type="button"
      role="tab"
      aria-selected={active}
      onClick={onClick}
      className={`dp-tab${active ? " is-active" : ""}`}
    >
      <span className="dp-tab-icon">{icon}</span>
      <span className="dp-tab-label">{label}</span>
    </button>
  );
}

function CategoryChip({
  active,
  onClick,
  kind,
  label,
}: {
  active: boolean;
  onClick: () => void;
  kind: FlagKind;
  label: string;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`dp-chip${active ? " is-active" : ""}`}
    >
      <span className={`dp-chip-bar dp-chip-bar-${kind}`} />
      {label}
    </button>
  );
}

function ScoreCard({ result }: { result: ScanResult }) {
  const { authenticity, breakdown } = result;
  const r = 18;
  const c = 2 * Math.PI * r;
  const dash = c * (authenticity / 100);
  const verdict =
    authenticity >= 75 ? "human" : authenticity >= 45 ? "mixed" : "ai";
  const stroke =
    verdict === "human"
      ? "var(--color-human)"
      : verdict === "mixed"
        ? "var(--color-mixed)"
        : "var(--color-ai)";

  return (
    <div className="dp-score">
      <div className="dp-score-head">
        <div className="dp-score-ring">
          <svg viewBox="0 0 44 44" width={44} height={44}>
            <circle cx={22} cy={22} r={r} fill="none" stroke="var(--color-line)" strokeWidth={4} />
            <circle
              cx={22}
              cy={22}
              r={r}
              fill="none"
              stroke={stroke}
              strokeWidth={4}
              strokeLinecap="round"
              strokeDasharray={`${dash} ${c - dash}`}
              transform="rotate(-90 22 22)"
            />
          </svg>
          <div className="dp-score-num">{authenticity}</div>
        </div>
        <div className="dp-score-info">
          <div className="dp-score-name">
            Overall <em>authenticity</em>
          </div>
          <div className="dp-score-meta">
            {result.flags.length} detection{result.flags.length === 1 ? "" : "s"}
          </div>
        </div>
      </div>

      <div className="dp-score-bars">
        <BarRow label="AI-generated" pct={breakdown.gen} kind="gen" />
        <BarRow label="Model match" pct={breakdown.match} kind="match" />
        <BarRow label="Plagiarism" pct={breakdown.plag} kind="plag" />
      </div>
    </div>
  );
}

function BarRow({ label, pct, kind }: { label: string; pct: number; kind: FlagKind }) {
  return (
    <div className="dp-bar-row">
      <span className="dp-bar-lbl">{label}</span>
      <div className="dp-bar-track">
        <div className={`dp-bar-fill dp-bar-fill-${kind}`} style={{ width: `${pct}%` }} />
      </div>
      <span className="dp-bar-val">{pct}%</span>
    </div>
  );
}

function SuggestionCard({
  flag,
  active,
  onClick,
}: {
  flag: AiFlag;
  active: boolean;
  onClick: () => void;
}) {
  const KIND_LABEL: Record<FlagKind, string> = {
    gen: "AI-Generated",
    match: "Model match",
    plag: "Plagiarism",
  };

  return (
    <button
      type="button"
      onClick={onClick}
      className={`dp-card${active ? " is-active" : ""}`}
    >
      <div className="dp-card-head">
        <div className={`dp-card-mark dp-card-mark-${flag.kind}`} />
        <div className="dp-card-info">
          <div className="dp-card-row">
            <span className={`dp-card-cat dp-card-cat-${flag.kind}`}>
              {KIND_LABEL[flag.kind]}
            </span>
            <span className="dp-card-dot" />
            <span className="dp-card-conf">
              <strong>{flag.confidence}%</strong> confidence
            </span>
          </div>
          <div className="dp-card-title">{flag.label}</div>
        </div>
      </div>

      {flag.match && (
        <div className="dp-match">
          <span className={`dp-match-logo dp-match-logo-${flag.match.vendor}`}>
            {flag.match.vendor === "openai" ? "AI" : flag.match.vendor === "anthropic" ? "An" : "G"}
          </span>
          <div className="dp-match-info">
            <div className="dp-match-name">{flag.match.name}</div>
            <div className="dp-match-meta">{flag.match.vendor.toUpperCase()} · model match</div>
          </div>
          <div className="dp-match-conf">{flag.confidence}%</div>
        </div>
      )}

      {flag.source && (
        <div className="dp-plag">
          <div className="dp-plag-url">
            <LinkIcon />
            {flag.source.url}
          </div>
          <div className="dp-plag-quote">{flag.source.quote}</div>
        </div>
      )}
    </button>
  );
}

function ScanningSkeleton() {
  return (
    <div className="dp-skeleton" role="status" aria-live="polite">
      <div className="dp-skeleton-line" />
      <div className="dp-skeleton-line dp-skeleton-line-short" />
      <div className="dp-skeleton-card" />
      <div className="dp-skeleton-card" />
      <div className="dp-skeleton-meta">Scanning document…</div>
    </div>
  );
}

function IdleState() {
  return (
    <div className="dp-empty">
      <div className="dp-empty-icon"><SparkleIcon /></div>
      <div className="dp-empty-title">Nothing to detect yet</div>
      <div className="dp-empty-sub">
        Paste or write content in the editor — we&rsquo;ll scan it as you go.
      </div>
    </div>
  );
}

function EmptyState() {
  return (
    <div className="dp-empty">
      <div className="dp-empty-icon">
        <CheckIcon />
      </div>
      <div className="dp-empty-title">All clear</div>
      <div className="dp-empty-sub">No AI patterns detected in this draft.</div>
    </div>
  );
}

/* ── Inline icons (small set; intentionally not pulled from frontend/components/Icon
   so the panel can ship without depending on every named icon being present). ── */

function ShieldIcon() {
  return (
    <svg viewBox="0 0 24 24" width={14} height={14} fill="none" stroke="currentColor" strokeWidth={1.85}>
      <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" />
    </svg>
  );
}
function SparkleIcon() {
  return (
    <svg viewBox="0 0 24 24" width={14} height={14} fill="currentColor" aria-hidden>
      <path d="M12 2 C12 8 16 12 22 12 C16 12 12 16 12 22 C12 16 8 12 2 12 C8 12 12 8 12 2 Z" />
    </svg>
  );
}
function QuoteIcon() {
  return (
    <svg viewBox="0 0 24 24" width={14} height={14} fill="none" stroke="currentColor" strokeWidth={1.85}>
      <path d="M3 21c3 0 7-1 7-8V5c0-1.25-.756-2.017-2-2H4c-1.25 0-2 .75-2 1.972V11c0 1.25.75 2 2 2 1 0 1 0 1 1v1c0 1-1 2-2 2s-1 .008-1 1.031V20c0 1 0 1 1 1z" />
      <path d="M15 21c3 0 7-1 7-8V5c0-1.25-.757-2.017-2-2h-4c-1.25 0-2 .75-2 1.972V11c0 1.25.75 2 2 2h.75c0 2.25.25 4-2.75 4v3c0 1 0 1 1 1z" />
    </svg>
  );
}
function ChevronRightIcon() {
  return (
    <svg viewBox="0 0 24 24" width={14} height={14} fill="none" stroke="currentColor" strokeWidth={2}>
      <polyline points="9 18 15 12 9 6" />
    </svg>
  );
}
function CheckIcon() {
  return (
    <svg viewBox="0 0 24 24" width={16} height={16} fill="none" stroke="currentColor" strokeWidth={2}>
      <polyline points="20 6 9 17 4 12" />
    </svg>
  );
}
function LinkIcon() {
  return (
    <svg viewBox="0 0 24 24" width={11} height={11} fill="none" stroke="currentColor" strokeWidth={2}>
      <path d="M10 13a5 5 0 0 0 7.54.54l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.71" />
      <path d="M14 11a5 5 0 0 0-7.54-.54l-3 3a5 5 0 0 0 7.07 7.07l1.71-1.71" />
    </svg>
  );
}

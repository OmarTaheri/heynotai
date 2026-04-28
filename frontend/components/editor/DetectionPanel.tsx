"use client";

import { useState } from "react";
import { Icon } from "@/components/Icon";
import { CategorySegmented, type ScanState, type SegmentItem } from "@/components/editor-shell";
import type { FlagKind, ScanResult } from "@/lib/detection-types";
import { VerdictCard } from "./VerdictCard";
import { FindingCard } from "./FindingCard";
import { DeepScanCta } from "./DeepScanCta";
import styles from "./DetectionPanel.module.css";

type CategoryFilter = FlagKind | "all";

interface Props {
  scanState: ScanState;
  result: ScanResult | null;
  selectedId: string | null;
  onSelect: (id: string) => void;
  /** Optional excerpts keyed by flag id so cards can quote the document. */
  excerpts?: Record<string, string>;
}

const SEGMENTS: SegmentItem<FlagKind>[] = [
  { key: "gen", label: "AI-generated", swatch: "var(--color-ai)" },
  { key: "match", label: "Model match", swatch: "var(--color-mixed)" },
  { key: "plag", label: "Plagiarism", swatch: "var(--color-info)" },
];

export function DetectionPanel({
  scanState,
  result,
  selectedId,
  onSelect,
  excerpts,
}: Props) {
  const [filter, setFilter] = useState<CategoryFilter>("all");

  const visibleFlags =
    result?.flags.filter((f) => filter === "all" || f.kind === filter) ?? [];

  return (
    <div className={styles.scroll}>
      <header className={styles.header}>
        <h2 className={styles.title}>
          AI <em>detection</em>
        </h2>
        <button type="button" className={styles.help} aria-label="Help">
          <Icon name="info" size={14} />
        </button>
      </header>

      <div className={styles.seg}>
        <CategorySegmented
          items={SEGMENTS}
          value={filter}
          onChange={setFilter}
          ariaLabel="Detection category"
        />
      </div>

      {scanState === "scanning" && <ScanningSkeleton />}

      {scanState === "done" && result && (
        <>
          <VerdictCard result={result} />
          <div className={styles.findings}>
            {visibleFlags.map((flag) => (
              <FindingCard
                key={flag.id}
                flag={flag}
                active={selectedId === flag.id}
                onClick={() => onSelect(flag.id)}
                excerpt={excerpts?.[flag.id]}
              />
            ))}
            {visibleFlags.length === 0 && <EmptyState />}
          </div>
          <DeepScanCta />
        </>
      )}

      {scanState === "idle" && <IdleState />}
    </div>
  );
}

function ScanningSkeleton() {
  return (
    <div className={styles.skeleton} role="status" aria-live="polite">
      <div className={styles.skeletonCard} />
      <div className={`${styles.skeletonCard} ${styles.skeletonCardSm}`} />
      <div className={`${styles.skeletonCard} ${styles.skeletonCardSm}`} />
      <div className={styles.skeletonMeta}>Scanning document…</div>
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

function EmptyState() {
  return (
    <div className={styles.empty}>
      <div className={styles.emptyTitle}>All clear</div>
      <div className={styles.emptySub}>No matches in this category.</div>
    </div>
  );
}

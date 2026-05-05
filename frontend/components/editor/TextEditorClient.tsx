"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Editor, type EditorHandle } from "@/components/editor/Editor";
import { EditableTitle } from "@/components/editor/EditableTitle";
import { EditorShell, EditorTopBar, type ScanState } from "@/components/editor-shell";
import { DocMeta } from "@/components/editor/DocMeta";
import { TextEditorToolbar } from "@/components/editor/TextEditorToolbar";
import { DetectionPanel, MIN_SCAN_WORDS } from "@/components/editor/DetectionPanel";
import { ScanText, scanDurationMs as scanDurationFor } from "@/components/editor/ScanText";
import { mockScan } from "@/lib/scan-mock";
import { rescan as rescanApi, updateScan } from "@/lib/scans-api";
import {
  getScanCollection,
  type ScanCollectionRef,
} from "@/lib/collection-items";
import { useScanMembers } from "@/lib/scan-members";
import { useScanPresence } from "@/lib/use-scan-presence";
import {
  engineResultToScanResult,
  extractScanError,
  placeholderTitle,
  scanResultToEngineEntry,
  synthesizeEngineResults,
  type EngineResultEntry,
  type Scan,
} from "@/lib/scan-types";
import { DEFAULT_SELECTION } from "@/lib/models-data";
import editorStyles from "@/app/editor/editor.module.css";

function countWords(text: string): number {
  const t = text.trim();
  return t === "" ? 0 : t.split(/\s+/).length;
}

interface Props {
  scan: Scan;
  /** Called by handleScan after the rescan POST succeeds so the parent
   *  /editor/[id] page can re-fetch the scan and resume polling on the
   *  same id without navigating to a new URL. */
  onRescanQueued?: () => void;
}

/** Renders a saved (or synthetic) text scan. The DB-backed result is
 *  shown immediately — no opening scan animation. The toolbar's Scan
 *  button re-scans the same record in place (no new id, no navigation);
 *  for synthetic (non-persisted) scans it falls back to the local mock
 *  used by the marketing-hero handoff. */
export function TextEditorClient({ scan, onRescanQueued }: Props) {
  const persisted = !!scan.id;
  const presenceScanId = persisted ? scan.id : null;
  const { members } = useScanMembers(presenceScanId);
  const { activeIds } = useScanPresence(presenceScanId);

  const initialText = scan.content ?? "";
  const titlePlaceholder = placeholderTitle(scan);
  const [title, setTitle] = useState(scan.title || titlePlaceholder);
  const [engineResults, setEngineResults] = useState<Record<string, EngineResultEntry>>(
    () => synthesizeEngineResults(scan),
  );
  const [scanState, setScanState] = useState<ScanState>(() => {
    if (!persisted) return "idle";
    if (scan.status === "queued" || scan.status === "scanning") return "scanning";
    if (scan.status === "failed") return "failed";
    return "done";
  });
  const [scanError, setScanError] = useState<{ code?: string; message?: string } | null>(() =>
    scan.status === "failed" ? extractScanError(scan) : null,
  );
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [highlightsOn, setHighlightsOn] = useState(true);
  const [engineId, setEngineId] = useState<string>(scan.engineId || DEFAULT_SELECTION.txt);
  const [linkedCollection, setLinkedCollection] = useState<ScanCollectionRef | null>(null);

  // The parent (`/editor/[id]/page.tsx`) polls the scan while it sits
  // in queued/scanning and re-renders us with the live row. React to
  // status transitions so the canvas swaps from the scanning animation
  // to the result/failed view as soon as the background detection lands.
  useEffect(() => {
    if (!persisted) return;
    if (scan.status === "queued" || scan.status === "scanning") {
      setScanState("scanning");
      setScanError(null);
    } else if (scan.status === "failed") {
      setScanState("failed");
      setScanError(extractScanError(scan));
    } else {
      setScanState("done");
      setScanError(null);
      // Merge — the row may not carry sibling entries yet (e.g. the PB
      // migration hasn't been applied, or the backend hasn't been
      // updated to persist the map). Local in-session cache survives
      // the merge even if the backend forgets.
      setEngineResults((prev) => ({ ...prev, ...synthesizeEngineResults(scan) }));
    }
  }, [persisted, scan]);

  // Selected-engine result derivation. When the user changes the model
  // picker, this flips immediately to the cached entry for the new
  // engine — no rescan needed. The DetectionPanel reads `appliedEngineId`
  // to decide whether to surface the "Test again" button: if a cached
  // entry exists, applied === selected and the button stays hidden.
  const activeEntry = engineResults[engineId];
  const result = useMemo(
    () => (activeEntry ? engineResultToScanResult(activeEntry) : null),
    [activeEntry],
  );
  const appliedEngineId = activeEntry ? engineId : "";
  const scanDurationMs = activeEntry?.scanDurationMs;
  const scannedAt = activeEntry?.scanCompletedAt;

  // Fetch the scan's current collection link (single-link UX in the
  // editor — first row wins). Skips synthetic scans, which have no PB
  // record. Re-runs whenever the scan id changes (poll-driven re-render
  // keeps the same id, so this only fires once per persisted scan).
  useEffect(() => {
    if (!persisted) {
      setLinkedCollection(null);
      return;
    }
    let cancelled = false;
    getScanCollection(scan.id)
      .then((c) => {
        if (!cancelled) setLinkedCollection(c);
      })
      .catch(() => {
        if (!cancelled) setLinkedCollection(null);
      });
    return () => {
      cancelled = true;
    };
  }, [persisted, scan.id]);

  const editorRef = useRef<EditorHandle>(null);
  const scanRunRef = useRef<{ cleanup: () => void } | null>(null);

  const flags = useMemo(() => result?.flags ?? [], [result]);
  const flagIndex = useMemo(() => {
    if (!selectedId) return 0;
    const idx = flags.findIndex((f) => f.id === selectedId);
    return idx === -1 ? 0 : idx;
  }, [flags, selectedId]);

  const handleSelect = useCallback(
    (id: string) => {
      setSelectedId(id);
      const flag = flags.find((f) => f.id === id);
      if (flag) editorRef.current?.focusFlag(flag);
    },
    [flags],
  );

  const handlePrev = useCallback(() => {
    if (flags.length === 0) return;
    const next = (flagIndex - 1 + flags.length) % flags.length;
    handleSelect(flags[next].id);
  }, [flags, flagIndex, handleSelect]);

  const handleNext = useCallback(() => {
    if (flags.length === 0) return;
    const next = (flagIndex + 1) % flags.length;
    handleSelect(flags[next].id);
  }, [flags, flagIndex, handleSelect]);

  const runLocalScan = useCallback(
    (text: string, withEngineId: string) => {
      if (!text.trim()) return;
      scanRunRef.current?.cleanup();
      scanRunRef.current = null;

      setSelectedId(null);
      setScanState("scanning");

      const start = performance.now();
      const totalMs = scanDurationFor(text);
      const t = setTimeout(() => {
        const local = mockScan(text);
        setEngineResults((prev) => ({
          ...prev,
          [withEngineId]: scanResultToEngineEntry(local, performance.now() - start),
        }));
        setScanState("done");
        scanRunRef.current = null;
      }, totalMs);
      scanRunRef.current = { cleanup: () => clearTimeout(t) };
    },
    [],
  );

  // Synthetic (non-persisted) scans get a one-shot local mock on mount
  // so the marketing-hero handoff still animates and lands on a result.
  // Persisted scans skip this — their result already came from the API.
  useEffect(() => {
    if (persisted) return;
    if (countWords(initialText) < MIN_SCAN_WORDS) return;
    runLocalScan(initialText, engineId);
    return () => {
      scanRunRef.current?.cleanup();
      scanRunRef.current = null;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const handleScan = useCallback(async () => {
    if (scanState === "scanning") return;
    if (countWords(initialText) < MIN_SCAN_WORDS) return;
    if (persisted) {
      // In-place rescan: same scan id, same URL. Show the animation
      // immediately, post the user's chosen engineId so the backend
      // re-runs against that model, then ping the parent to re-fetch
      // and resume polling on this same id. We DO NOT clear the
      // engineResults cache here — sibling engines' verdicts must
      // survive a rescan of one engine.
      setSelectedId(null);
      setScanState("scanning");
      setScanError(null);
      try {
        await rescanApi(scan.id, engineId);
        onRescanQueued?.();
      } catch {
        // Fall through to local mock so the user still sees a result.
        runLocalScan(initialText, engineId);
      }
      return;
    }
    runLocalScan(initialText, engineId);
  }, [engineId, initialText, onRescanQueued, persisted, runLocalScan, scan.id, scanState]);

  const wordCount = useMemo(() => countWords(initialText), [initialText]);

  const excerpts = useMemo(() => {
    const out: Record<string, string> = {};
    if (!result || !initialText) return out;
    for (const f of result.flags) {
      out[f.id] = initialText.slice(Math.max(0, f.from - 1), Math.max(0, f.to - 1));
    }
    return out;
  }, [result, initialText]);

  const mainCls = [
    editorStyles.canvas,
    highlightsOn ? "" : editorStyles.canvasNoHighlights,
    scanState === "scanning" ? editorStyles.canvasScanning : "",
  ]
    .filter(Boolean)
    .join(" ");

  return (
    <EditorShell
      mainClassName={mainCls}
      topbar={
        <EditorTopBar
          crumbs={[]}
          docName={title}
          members={members}
          activeIds={activeIds}
          linkedCollection={linkedCollection ?? undefined}
          onAddCollection={
            linkedCollection
              ? undefined
              : {
                  scanId: persisted ? scan.id : null,
                  onLinked: (c) => setLinkedCollection(c),
                }
          }
          onDelete={{ scanId: persisted ? scan.id : null }}
        />
      }
      canvas={
        <div className={editorStyles.scroll}>
          <div className={editorStyles.docWrap}>
            <DocMeta
              wordCount={wordCount}
              scanState={scanState}
              scanDurationMs={scanDurationMs}
              scannedAt={scannedAt}
              origin={scan.origin}
            />
            <article className={editorStyles.doc}>
              <EditableTitle
                className={editorStyles.title}
                dimClassName={editorStyles.titleDim}
                initial={scan.title || titlePlaceholder}
                isPlaceholder={title === titlePlaceholder}
                onChange={(t) => setTitle(t === "" ? titlePlaceholder : t)}
                onCommit={
                  persisted
                    ? (t) => {
                        updateScan(scan.id, { title: t }).catch(() => {});
                      }
                    : undefined
                }
              />
              <div data-scan-root>
                {scanState === "scanning" ? (
                  <ScanText text={initialText} />
                ) : (
                  <Editor
                    ref={editorRef}
                    initialText={initialText}
                    flags={flags}
                    selectedId={selectedId}
                    onFlagClick={handleSelect}
                  />
                )}
              </div>
            </article>
          </div>
        </div>
      }
      inspector={
        <DetectionPanel
          scanState={scanState}
          result={result}
          scanError={scanError}
          selectedId={selectedId}
          onSelect={handleSelect}
          engineId={engineId}
          onEngineChange={setEngineId}
          appliedEngineId={appliedEngineId}
          onRetest={handleScan}
          excerpts={excerpts}
          wordCount={wordCount}
        />
      }
      toolbar={
        <TextEditorToolbar
          flagIndex={flagIndex}
          flagTotal={flags.length}
          scanning={scanState === "scanning"}
          highlightsOn={highlightsOn}
          onPrev={handlePrev}
          onNext={handleNext}
          onScan={handleScan}
          onToggleHighlights={() => setHighlightsOn((v) => !v)}
        />
      }
    />
  );
}

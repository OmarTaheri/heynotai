"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { EditorShell, EditorTopBar, type ScanState } from "@/components/editor-shell";
import { DetectionPanel } from "@/components/editor/DetectionPanel";
import { EditableTitle } from "@/components/editor/EditableTitle";
import { AudioCanvas, type AudioCanvasHandle } from "@/components/editor/AudioCanvas";
import { AudioEditorToolbar } from "@/components/editor/AudioEditorToolbar";
import { MediaDocMeta } from "@/components/editor/MediaDocMeta";
import { mockAudioScan } from "@/lib/scan-mock";
import { rescan as rescanApi, updateScan } from "@/lib/scans-api";
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
import {
  getScanCollection,
  type ScanCollectionRef,
} from "@/lib/collection-items";
import { useScanMembers } from "@/lib/scan-members";
import { useScanPresence } from "@/lib/use-scan-presence";
import editorStyles from "@/app/editor/editor.module.css";

interface Props {
  scan: Scan;
  /** Optional override for the audio src — used by the showcase route
   *  to point at the demo asset when no real file is uploaded. */
  fallbackSrc?: string;
  /** Trigger a re-fetch + resume polling on the same scan id after a
   *  rescan POST. Set by `/editor/[id]/page.tsx`. */
  onRescanQueued?: () => void;
}

export function AudioEditorClient({ scan, fallbackSrc, onRescanQueued }: Props) {
  const persisted = !!scan.id;
  const src = scan.fileUrl || scan.sourceUrl || fallbackSrc || "";
  const presenceScanId = persisted ? scan.id : null;
  const { members } = useScanMembers(presenceScanId);
  const { activeIds } = useScanPresence(presenceScanId);

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
  const [engineId, setEngineId] = useState<string>(scan.engineId || DEFAULT_SELECTION.aud);
  const [linkedCollection, setLinkedCollection] = useState<ScanCollectionRef | null>(null);

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
      // migration hasn't been applied). Local in-session cache survives.
      setEngineResults((prev) => ({ ...prev, ...synthesizeEngineResults(scan) }));
    }
  }, [persisted, scan]);

  const activeEntry = engineResults[engineId];
  const result = useMemo(
    () => (activeEntry ? engineResultToScanResult(activeEntry) : null),
    [activeEntry],
  );
  const appliedEngineId = activeEntry ? engineId : "";
  const scanDurationMs = activeEntry?.scanDurationMs;
  const scannedAt = activeEntry?.scanCompletedAt;

  const initialDuration = scan.durationMs > 0 ? scan.durationMs : 45_000;
  const [durationMs, setDurationMs] = useState(initialDuration);
  const [currentMs, setCurrentMs] = useState(0);
  const [playing, setPlaying] = useState(false);

  const canvasRef = useRef<AudioCanvasHandle>(null);
  const scanRunRef = useRef<{ cleanup: () => void } | null>(null);

  const runLocalScan = useCallback(
    (withEngineId: string, dur: number) => {
      scanRunRef.current?.cleanup();
      scanRunRef.current = null;
      setScanState("scanning");
      const start = performance.now();
      const t = setTimeout(() => {
        const local = mockAudioScan(dur);
        setEngineResults((prev) => ({
          ...prev,
          [withEngineId]: scanResultToEngineEntry(local, performance.now() - start),
        }));
        setScanState("done");
        scanRunRef.current = null;
      }, 2000);
      scanRunRef.current = { cleanup: () => clearTimeout(t) };
    },
    [],
  );

  const handleScan = useCallback(async () => {
    if (scanState === "scanning") return;
    if (persisted) {
      // In-place rescan: same id, same URL. Sibling engine results in
      // the cache survive — only the active engine's entry is overwritten
      // when the new scan lands.
      setScanState("scanning");
      setScanError(null);
      try {
        await rescanApi(scan.id, engineId);
        onRescanQueued?.();
      } catch {
        runLocalScan(engineId, durationMs);
      }
      return;
    }
    runLocalScan(engineId, durationMs);
  }, [durationMs, engineId, onRescanQueued, persisted, runLocalScan, scan.id, scanState]);

  return (
    <EditorShell
      mainClassName={editorStyles.canvas}
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
            <MediaDocMeta
              chipLabel="Audio"
              stats={`${fmt(durationMs)} · 48kHz · stereo`}
              scanState={scanState}
              scanDurationMs={scanDurationMs}
              scannedAt={scannedAt}
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
              <AudioCanvas
                ref={canvasRef}
                src={src}
                scanning={scanState === "scanning"}
                durationMs={durationMs}
                currentMs={currentMs}
                playing={playing}
                onTimeChange={setCurrentMs}
                onDurationChange={setDurationMs}
                onPlayingChange={setPlaying}
              />
            </article>
          </div>
        </div>
      }
      inspector={
        <DetectionPanel
          mode="analyzer"
          contentType="aud"
          scanState={scanState}
          result={result}
          scanError={scanError}
          selectedId={null}
          onSelect={() => {}}
          engineId={engineId}
          onEngineChange={setEngineId}
          appliedEngineId={appliedEngineId}
          onRetest={handleScan}
        />
      }
      toolbar={
        <AudioEditorToolbar
          scanning={scanState === "scanning"}
          playing={playing}
          currentMs={currentMs}
          durationMs={durationMs}
          onScan={handleScan}
          onTogglePlay={() => canvasRef.current?.togglePlay()}
          onSkipBack={() => canvasRef.current?.seekRelative(-5000)}
          onSkipForward={() => canvasRef.current?.seekRelative(5000)}
        />
      }
    />
  );
}

function fmt(ms: number) {
  const total = Math.max(0, Math.round(ms / 1000));
  const m = Math.floor(total / 60);
  const s = total % 60;
  return `${m.toString().padStart(2, "0")}:${s.toString().padStart(2, "0")}`;
}

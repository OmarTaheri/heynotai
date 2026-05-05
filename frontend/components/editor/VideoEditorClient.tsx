"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { EditorShell, EditorTopBar, type ScanState } from "@/components/editor-shell";
import { DetectionPanel } from "@/components/editor/DetectionPanel";
import { EditableTitle } from "@/components/editor/EditableTitle";
import { VideoCanvas, type VideoCanvasHandle } from "@/components/editor/VideoCanvas";
import { VideoEditorToolbar } from "@/components/editor/VideoEditorToolbar";
import { VideoScrubBar } from "@/components/editor/VideoScrubBar";
import { MediaDocMeta } from "@/components/editor/MediaDocMeta";
import { mockVideoScan } from "@/lib/scan-mock";
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
import { useScanMembers } from "@/lib/scan-members";
import { useScanPresence } from "@/lib/use-scan-presence";
import editorStyles from "@/app/editor/editor.module.css";

interface Props {
  scan: Scan;
  fallbackSrc?: string;
  /** Trigger a re-fetch + resume polling on the same scan id after a
   *  rescan POST. Set by `/editor/[id]/page.tsx`. */
  onRescanQueued?: () => void;
}

export function VideoEditorClient({ scan, fallbackSrc, onRescanQueued }: Props) {
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
  const [engineId, setEngineId] = useState<string>(scan.engineId || DEFAULT_SELECTION.vid);

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

  const initialDuration = scan.durationMs > 0 ? scan.durationMs : 30_000;
  const [durationMs, setDurationMs] = useState(initialDuration);
  const [currentMs, setCurrentMs] = useState(0);
  const [playing, setPlaying] = useState(false);

  const canvasRef = useRef<VideoCanvasHandle>(null);
  const scanRunRef = useRef<{ cleanup: () => void } | null>(null);

  const runLocalScan = useCallback((withEngineId: string, dur: number) => {
    scanRunRef.current?.cleanup();
    scanRunRef.current = null;
    setScanState("scanning");
    const start = performance.now();
    const t = setTimeout(() => {
      const local = mockVideoScan(dur);
      setEngineResults((prev) => ({
        ...prev,
        [withEngineId]: scanResultToEngineEntry(local, performance.now() - start),
      }));
      setScanState("done");
      scanRunRef.current = null;
    }, 2400);
    scanRunRef.current = { cleanup: () => clearTimeout(t) };
  }, []);

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
          crumbs={["editor", "video"]}
          docName={title}
          members={members}
          activeIds={activeIds}
        />
      }
      canvas={
        <div className={editorStyles.scrollCentered}>
          <div className={editorStyles.docWrapCentered}>
            <header className={editorStyles.docHeader}>
              <MediaDocMeta
                chipLabel="Video"
                stats={`${fmt(durationMs)} · 1080p · mp4`}
                scanState={scanState}
                scanDurationMs={scanDurationMs}
                scannedAt={scannedAt}
              />
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
            </header>
            <article className={editorStyles.docMedia}>
              <VideoCanvas
                ref={canvasRef}
                src={src}
                scanning={scanState === "scanning"}
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
          contentType="vid"
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
        <>
          <VideoScrubBar
            currentMs={currentMs}
            durationMs={durationMs}
            onSeek={(ms) => canvasRef.current?.seekToMs(ms)}
          />
          <VideoEditorToolbar
            scanning={scanState === "scanning"}
            playing={playing}
            currentMs={currentMs}
            durationMs={durationMs}
            onScan={handleScan}
            onTogglePlay={() => canvasRef.current?.togglePlay()}
            onStepBack={() => canvasRef.current?.seekRelative(-1000)}
            onStepForward={() => canvasRef.current?.seekRelative(1000)}
          />
        </>
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

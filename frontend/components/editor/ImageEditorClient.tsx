"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { EditorShell, EditorTopBar, type ScanState } from "@/components/editor-shell";
import { DetectionPanel } from "@/components/editor/DetectionPanel";
import { EditableTitle } from "@/components/editor/EditableTitle";
import { ImageCanvas } from "@/components/editor/ImageCanvas";
import { ImageEditorToolbar } from "@/components/editor/ImageEditorToolbar";
import { MediaDocMeta } from "@/components/editor/MediaDocMeta";
import { mockImageScan } from "@/lib/scan-mock";
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

export function ImageEditorClient({ scan, fallbackSrc, onRescanQueued }: Props) {
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
  const [zoom, setZoom] = useState(1);
  const [rotation, setRotation] = useState(0);
  const [engineId, setEngineId] = useState<string>(scan.engineId || DEFAULT_SELECTION.img);

  const scanRunRef = useRef<{ cleanup: () => void } | null>(null);

  // Parent polls the scan record while it's queued/scanning; mirror its
  // status into our local scanState so the canvas swaps from the
  // scanning animation to the result/failed view when the bg job lands.
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

  const runLocalScan = useCallback((withEngineId: string) => {
    scanRunRef.current?.cleanup();
    scanRunRef.current = null;
    setScanState("scanning");
    const start = performance.now();
    const t = setTimeout(() => {
      const local = mockImageScan();
      setEngineResults((prev) => ({
        ...prev,
        [withEngineId]: scanResultToEngineEntry(local, performance.now() - start),
      }));
      setScanState("done");
      scanRunRef.current = null;
    }, 2200);
    scanRunRef.current = { cleanup: () => clearTimeout(t) };
  }, []);

  const handleScan = useCallback(async () => {
    if (scanState === "scanning") return;
    if (persisted) {
      // In-place rescan: same id, same URL. Animation plays here while
      // the parent re-fetches and polls. Sibling engine results in the
      // cache survive — only the active engine's entry is overwritten
      // when the new scan lands.
      setScanState("scanning");
      setScanError(null);
      try {
        await rescanApi(scan.id, engineId);
        onRescanQueued?.();
      } catch {
        runLocalScan(engineId);
      }
      return;
    }
    runLocalScan(engineId);
  }, [engineId, onRescanQueued, persisted, runLocalScan, scan.id, scanState]);

  const stats = scan.sizeBytes > 0 ? "uploaded image" : "1280×960 · jpg";

  return (
    <EditorShell
      mainClassName={editorStyles.canvas}
      topbar={
        <EditorTopBar
          crumbs={["editor", "image"]}
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
                chipLabel="Image"
                stats={stats}
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
              <ImageCanvas
                src={src}
                scanning={scanState === "scanning"}
                zoom={zoom}
                rotation={rotation}
              />
            </article>
          </div>
        </div>
      }
      inspector={
        <DetectionPanel
          mode="analyzer"
          contentType="img"
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
        <ImageEditorToolbar
          scanning={scanState === "scanning"}
          zoom={zoom}
          onScan={handleScan}
          onZoomIn={() => setZoom((z) => Math.min(2.5, +(z + 0.1).toFixed(2)))}
          onZoomOut={() => setZoom((z) => Math.max(0.5, +(z - 0.1).toFixed(2)))}
          onZoomReset={() => setZoom(1)}
          onRotate={() => setRotation((r) => (r + 90) % 360)}
        />
      }
    />
  );
}

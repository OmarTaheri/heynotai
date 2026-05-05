"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { EditorShell, EditorTopBar, type ScanState } from "@/components/editor-shell";
import { DetectionPanel } from "@/components/editor/DetectionPanel";
import { EditableTitle } from "@/components/editor/EditableTitle";
import { YouTubeCanvas } from "@/components/editor/YouTubeCanvas";
import { MediaDocMeta } from "@/components/editor/MediaDocMeta";
import { rescan as rescanApi, updateScan } from "@/lib/scans-api";
import {
  engineResultToScanResult,
  extractScanError,
  placeholderTitle,
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
  onRescanQueued?: () => void;
}

export function YouTubeEditorClient({ scan, onRescanQueued }: Props) {
  const persisted = !!scan.id;
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

  const videoId = useMemo(() => parseYoutubeId(scan.sourceUrl), [scan.sourceUrl]);

  const verdict = activeEntry?.verdict ?? null;
  const aiPct = activeEntry?.aiPct ?? null;

  const handleScan = useCallback(async () => {
    if (scanState === "scanning") return;
    if (!persisted) return;
    setScanState("scanning");
    setScanError(null);
    try {
      await rescanApi(scan.id, engineId);
      onRescanQueued?.();
    } catch {
      // Surface the error state — the editor will refetch and re-render
      // either way once the next poll lands.
      setScanState("failed");
    }
  }, [engineId, onRescanQueued, persisted, scan.id, scanState]);

  const durationMs = scan.durationMs > 0 ? scan.durationMs : 0;

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
        <div className={editorStyles.scrollCentered}>
          <div className={editorStyles.docWrapCentered}>
            <header className={editorStyles.docHeader}>
              <MediaDocMeta
                chipLabel="YouTube"
                stats={youtubeStats(scan, durationMs)}
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
              <YouTubeCanvas
                videoId={videoId}
                scanState={scanState}
                verdict={verdict}
                aiPct={aiPct}
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
    />
  );
}

/** Extract a YouTube video id from a /watch?v= or /shorts/<id> URL.
 *  Returns null when the URL is malformed or not from YouTube — the
 *  canvas will then render its empty state. */
export function parseYoutubeId(url: string | null | undefined): string | null {
  if (!url) return null;
  try {
    const u = new URL(url);
    const host = u.hostname.replace(/^www\./, "");
    if (host === "youtu.be") {
      const id = u.pathname.split("/").filter(Boolean)[0];
      return id || null;
    }
    if (host.endsWith("youtube.com")) {
      if (u.pathname === "/watch" || u.pathname.startsWith("/watch")) {
        return u.searchParams.get("v");
      }
      if (u.pathname.startsWith("/shorts/")) {
        const id = u.pathname.split("/shorts/")[1]?.split(/[/?#]/)[0];
        return id || null;
      }
      if (u.pathname.startsWith("/embed/")) {
        const id = u.pathname.split("/embed/")[1]?.split(/[/?#]/)[0];
        return id || null;
      }
    }
    return null;
  } catch {
    return null;
  }
}

function youtubeStats(scan: Scan, durationMs: number): string {
  const parts: string[] = [];
  if (durationMs > 0) parts.push(formatMs(durationMs));
  parts.push("youtube.com");
  if (scan.subtype === "yt-reel") parts.push("Shorts");
  return parts.join(" · ");
}

function formatMs(ms: number) {
  const total = Math.max(0, Math.round(ms / 1000));
  const m = Math.floor(total / 60);
  const s = total % 60;
  return `${m.toString().padStart(2, "0")}:${s.toString().padStart(2, "0")}`;
}

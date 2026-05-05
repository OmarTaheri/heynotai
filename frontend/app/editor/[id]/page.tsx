"use client";

import { useCallback, useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { getScan, ScanApiError } from "@/lib/scans-api";
import type { Scan } from "@/lib/scan-types";
import { TextEditorClient } from "@/components/editor/TextEditorClient";
import { AudioEditorClient } from "@/components/editor/AudioEditorClient";
import { ImageEditorClient } from "@/components/editor/ImageEditorClient";
import { VideoEditorClient } from "@/components/editor/VideoEditorClient";
import editorStyles from "../editor.module.css";

type State =
  | { kind: "loading" }
  | { kind: "loaded"; scan: Scan }
  | { kind: "not-found" };

const POLL_INTERVAL_MS = 1500;
const POLL_TIMEOUT_MS = 90_000;

/** Dynamic editor route. Client-component because the PocketBase auth
 *  token only lives in localStorage today (`frontend/lib/pocketbase.ts:8`)
 *  — there's no SSR auth path. On 401 we bounce to the marketing home
 *  with the login modal, mirroring `AuthGuard.tsx:31-33`.
 *
 *  Polls the scan record while it sits in `queued` or `scanning` so the
 *  editor canvas can show the loading animation until the background
 *  HF job updates the row. Stops polling on `done` / `failed` or after
 *  90s as a safety net.
 *
 *  Editor clients call `revalidate()` after triggering a rescan so the
 *  page re-fetches and resumes polling on the same id — no navigation,
 *  no remount. */
export default function EditorByIdPage() {
  const params = useParams<{ id: string }>();
  const router = useRouter();
  const [state, setState] = useState<State>({ kind: "loading" });
  const [pollNonce, setPollNonce] = useState(0);

  const id = params?.id ?? "";

  const revalidate = useCallback(() => {
    setPollNonce((n) => n + 1);
  }, []);

  useEffect(() => {
    if (!id) {
      setState({ kind: "not-found" });
      return;
    }
    let cancelled = false;
    let pollTimer: ReturnType<typeof setTimeout> | null = null;
    const startedAt = Date.now();

    const tick = async () => {
      try {
        const scan = await getScan(id);
        if (cancelled) return;
        setState({ kind: "loaded", scan });

        const inFlight = scan.status === "queued" || scan.status === "scanning";
        const timedOut = Date.now() - startedAt > POLL_TIMEOUT_MS;
        if (inFlight && !timedOut) {
          pollTimer = setTimeout(tick, POLL_INTERVAL_MS);
        }
      } catch (err) {
        if (cancelled) return;
        if (err instanceof ScanApiError && err.status === 401) {
          router.replace(`/?login=1&next=${encodeURIComponent(`/editor/${id}`)}`);
          return;
        }
        setState({ kind: "not-found" });
      }
    };

    tick();
    return () => {
      cancelled = true;
      if (pollTimer) clearTimeout(pollTimer);
    };
  }, [id, router, pollNonce]);

  if (state.kind === "loading") {
    return <div className={editorStyles.loadingState} aria-busy>Loading scan…</div>;
  }

  if (state.kind === "not-found") {
    return (
      <div className={editorStyles.loadingState}>
        <p>This scan couldn't be found.</p>
      </div>
    );
  }

  const { scan } = state;
  switch (scan.type) {
    case "aud":
      return <AudioEditorClient scan={scan} onRescanQueued={revalidate} />;
    case "img":
      return <ImageEditorClient scan={scan} onRescanQueued={revalidate} />;
    case "vid":
      return <VideoEditorClient scan={scan} onRescanQueued={revalidate} />;
    case "txt":
    case "web":
    case "soc":
    default:
      return <TextEditorClient scan={scan} onRescanQueued={revalidate} />;
  }
}

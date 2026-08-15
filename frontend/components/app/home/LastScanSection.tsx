"use client";

import { useCallback, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { SectionHead } from "@/components/ui/SectionHead";
import { Card } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { Icon } from "@/components/Icon";
import { AddToCollectionModal } from "@/components/app/library/AddToCollectionModal";
import { LastScanCard, type LastScan } from "./LastScanCard";
import { listScans, rescan as rescanApi, ScanApiError } from "@/lib/scans-api";
import { scanToLastScan } from "@/lib/last-scan-data";
import { formatRelative } from "@/lib/library-data";
import { useScansRealtime } from "@/lib/use-scans-realtime";

type State =
  | { kind: "loading" }
  | { kind: "empty" }
  | { kind: "signedOut" }
  | { kind: "error" }
  | { kind: "ready"; scan: LastScan; whenIso: string };

/** "Last scan" section of the home page — owns its own heading so the
 *  "· 2 minutes ago" subtitle reflects the scan actually on screen.
 *
 *  There is deliberately no demo fallback here. The card used to render
 *  a fabricated `student_essay_214.txt` result whenever the user had no
 *  scans (or the request failed), which made an empty account look like
 *  it had already detected AI in someone's essay. */
export function LastScanSection() {
  const router = useRouter();
  const realtimeTick = useScansRealtime();
  const [state, setState] = useState<State>({ kind: "loading" });
  const [addOpen, setAddOpen] = useState(false);
  const [rescanning, setRescanning] = useState(false);

  useEffect(() => {
    let cancelled = false;
    void (async () => {
      try {
        const result = await listScans({ perPage: 1 });
        if (cancelled) return;
        const recent = result.items[0];
        if (!recent) {
          setState({ kind: "empty" });
          return;
        }
        setState({
          kind: "ready",
          scan: scanToLastScan(recent),
          whenIso: recent.scanCompletedAt || recent.created,
        });
      } catch (err) {
        if (cancelled) return;
        setState(
          err instanceof ScanApiError && err.status === 401
            ? { kind: "signedOut" }
            : { kind: "error" },
        );
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [realtimeTick]);

  const scanId = state.kind === "ready" ? state.scan.id : null;

  const handleRescan = useCallback(async () => {
    if (!scanId || rescanning) return;
    setRescanning(true);
    try {
      await rescanApi(scanId);
      router.push(`/editor/${scanId}`);
    } catch {
      // Surfacing the failure in place would need an error slot this
      // card doesn't have; the editor shows the row's real status.
      router.push(`/editor/${scanId}`);
    } finally {
      setRescanning(false);
    }
  }, [rescanning, router, scanId]);

  const subtitle =
    state.kind === "ready" ? formatRelative(state.whenIso) : undefined;

  return (
    <section>
      <SectionHead
        title="Last scan"
        subtitle={subtitle}
        linkLabel="Open full view"
        linkHref="/app/library"
      />

      {state.kind === "ready" ? (
        <LastScanCard
          scan={state.scan}
          actions={{
            onOpen: () => router.push(`/editor/${state.scan.id}`),
            onAddToCollection: () => setAddOpen(true),
            onRescan: handleRescan,
            rescanning,
          }}
        />
      ) : (
        <LastScanPlaceholder kind={state.kind} />
      )}

      {addOpen && scanId && (
        <AddToCollectionModal
          scanIds={[scanId]}
          onClose={() => setAddOpen(false)}
          onAdded={() => setAddOpen(false)}
        />
      )}
    </section>
  );
}

function LastScanPlaceholder({
  kind,
}: {
  kind: "loading" | "empty" | "signedOut" | "error";
}) {
  if (kind === "loading") {
    return (
      <Card as="div" elevated>
        <div className="home-detail-empty" aria-busy>
          Loading your most recent scan…
        </div>
      </Card>
    );
  }

  const copy: Record<"empty" | "signedOut" | "error", string> = {
    empty:
      "No scans yet. Drop a file above, paste some text, or run a check from the browser extension — your most recent result shows up here.",
    signedOut: "Sign in to see your most recent scan.",
    error: "Couldn't load your most recent scan. Try refreshing the page.",
  };

  return (
    <Card as="div" elevated>
      <div className="home-detail-empty">
        <p>{copy[kind]}</p>
        {kind === "empty" && (
          <Button href="/app/library" variant="primary">
            <Icon name="plus" size={12} />
            Start a scan
          </Button>
        )}
      </div>
    </Card>
  );
}

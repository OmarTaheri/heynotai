"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { TextEditorClient } from "@/components/editor/TextEditorClient";
import { consumePendingScan } from "@/lib/scanHandoff";
import { syntheticScan, type Scan } from "@/lib/scan-types";
import { pb } from "@/lib/pocketbase";
import { createScan } from "@/lib/scans-api";
import editorStyles from "./editor.module.css";

/** Legacy `/editor` (no id). Two paths:
 *  - Authenticated visitor with pending text: persist via the API and
 *    redirect to `/editor/<id>` so they get a real shareable URL.
 *  - Anonymous visitor (e.g. coming from the marketing hero): render
 *    the editor with a synthetic in-memory Scan so the demo still works
 *    without an account. */
export default function EditorPage() {
  const router = useRouter();
  const [scan, setScan] = useState<Scan | null>(null);

  useEffect(() => {
    const pending = consumePendingScan();
    const seeded = pending?.text ?? "";

    if (pb.authStore.isValid && seeded.trim() !== "") {
      let cancelled = false;
      (async () => {
        try {
          const created = await createScan({
            type: "txt",
            origin: "paste",
            content: seeded,
          });
          if (!cancelled) router.replace(`/editor/${created.id}`);
        } catch {
          if (!cancelled) {
            setScan(syntheticScan({ type: "txt", content: seeded }));
          }
        }
      })();
      return () => {
        cancelled = true;
      };
    }

    setScan(syntheticScan({ type: "txt", content: seeded }));
  }, [router]);

  if (!scan) {
    return <div className={editorStyles.loadingState} aria-busy>Loading…</div>;
  }

  return <TextEditorClient scan={scan} />;
}

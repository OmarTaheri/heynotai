"use client";

import Link from "next/link";
import { useEffect, useMemo, useRef, useState } from "react";
import { Logo } from "@/components/Logo";
import { Editor, type EditorHandle } from "@/components/editor/Editor";
import { EditorScanOverlay } from "@/components/editor/EditorScanOverlay";
import { DetectionPanel } from "@/components/editor/DetectionPanel";
import { consumePendingScan } from "@/lib/scanHandoff";
import { mockScan } from "@/lib/scan-mock";
import type { ScanResult } from "@/lib/detection-types";

type ScanState = "idle" | "scanning" | "done";

const SCAN_DURATION_MS = 2800;

export default function EditorPage() {
  const [initialText, setInitialText] = useState<string | null>(null);
  const [result, setResult] = useState<ScanResult | null>(null);
  const [scanState, setScanState] = useState<ScanState>("idle");
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const editorRef = useRef<EditorHandle>(null);

  // Pull any text seeded by an upstream "Verify" / "Detect" CTA. Done
  // in an effect so SSR + hydration stay in sync (sessionStorage is
  // window-only). When nothing was seeded, render an empty document.
  useEffect(() => {
    const pending = consumePendingScan();
    const seeded = pending?.text ?? "";
    setInitialText(seeded);
    if (seeded.trim() !== "") {
      setScanState("scanning");
      const t = setTimeout(() => {
        setResult(mockScan(seeded));
        setScanState("done");
      }, SCAN_DURATION_MS);
      return () => clearTimeout(t);
    }
  }, []);

  const flags = useMemo(() => result?.flags ?? [], [result]);

  const handleSelect = (id: string) => {
    setSelectedId(id);
    const flag = flags.find((f) => f.id === id);
    if (flag) editorRef.current?.focusFlag(flag);
  };

  const wordCount = useMemo(() => {
    if (!initialText) return 0;
    const t = initialText.trim();
    return t === "" ? 0 : t.split(/\s+/).length;
  }, [initialText]);

  if (initialText === null) {
    // First paint before we've consulted sessionStorage. Render the
    // chrome but defer the editor so Tiptap doesn't mount with the
    // wrong content (the StarterKit boot is non-trivial to re-init).
    return (
      <div className="editor-app">
        <EditorHeader wordCount={0} />
        <main className="editor-main" />
        <DetectionPanel scanState="idle" result={null} selectedId={null} onSelect={() => {}} />
      </div>
    );
  }

  return (
    <div className="editor-app">
      <EditorHeader wordCount={wordCount} />

      <main className="editor-main">
        <div className="editor-scroll">
          <div className="editor-doc">
            <Editor
              ref={editorRef}
              initialText={initialText}
              flags={flags}
              selectedId={selectedId}
              onFlagClick={handleSelect}
            />
          </div>
          {scanState === "scanning" && <EditorScanOverlay />}
        </div>
      </main>

      <DetectionPanel
        scanState={scanState}
        result={result}
        selectedId={selectedId}
        onSelect={handleSelect}
      />
    </div>
  );
}

function EditorHeader({ wordCount }: { wordCount: number }) {
  return (
    <header className="editor-header">
      <Link href="/" className="editor-brand" aria-label="heynotai home">
        <Logo size="sm" startClosed />
      </Link>
      <div className="editor-header-meta">
        <span>{wordCount} word{wordCount === 1 ? "" : "s"}</span>
      </div>
      <div className="editor-header-actions">
        <Link href="/" className="editor-header-btn">Exit</Link>
      </div>
    </header>
  );
}

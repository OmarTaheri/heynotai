"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Editor, type EditorHandle } from "@/components/editor/Editor";
import { EditorShell, EditorTopBar, type ScanState } from "@/components/editor-shell";
import { DocMeta } from "@/components/editor/DocMeta";
import { TextEditorToolbar } from "@/components/editor/TextEditorToolbar";
import { DetectionPanel } from "@/components/editor/DetectionPanel";
import { runWordScan } from "@/components/editor/WordScanRunner";
import { consumePendingScan } from "@/lib/scanHandoff";
import { mockScan } from "@/lib/scan-mock";
import type { ScanResult } from "@/lib/detection-types";
import editorStyles from "./editor.module.css";

const SCAN_DURATION_MS = 2400;
const DEFAULT_TEXT = `In today's rapidly evolving world, technology has become an integral part of our daily lives, fundamentally reshaping the way we approach education. From elementary classrooms to university lecture halls, digital tools have revolutionized how students learn, collaborate, and engage with course material. The integration of technology in education is not merely a trend, but a transformative shift that offers numerous benefits while also presenting unique challenges. It is important to consider how these changes are shaping the future of learning for generations to come.

One of the most significant advantages of educational technology is accessibility. Online platforms and digital resources have democratized education, making high-quality learning materials available to anyone with an internet connection. Students in remote areas can now access the same lectures and resources as those at prestigious institutions, leveling the playing field in unprecedented ways. Furthermore, adaptive learning technologies leverage artificial intelligence to personalize the educational experience, tailoring content to each student's pace and learning style.

According to a 2023 Stanford report, students who use educational technology show a 27% improvement in retention. While the figure is plausible, the phrasing suggests this may have been paraphrased from another source — flagged for verification. The broader claim that thoughtful integration of digital tools can yield measurable academic gains is consistent with peer-reviewed research from the past decade.`;

const COLLABORATORS = [
  { initials: "YM" },
  { initials: "TK" },
  { initials: "DA" },
];

export default function EditorPage() {
  const [initialText, setInitialText] = useState<string | null>(null);
  const [result, setResult] = useState<ScanResult | null>(null);
  const [scanState, setScanState] = useState<ScanState>("idle");
  const [scanDurationMs, setScanDurationMs] = useState<number | undefined>(undefined);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [highlightsOn, setHighlightsOn] = useState(true);
  const editorRef = useRef<EditorHandle>(null);
  const docRef = useRef<HTMLDivElement>(null);
  const scanRunRef = useRef<{ cleanup: () => void } | null>(null);

  const runScan = useCallback((text: string) => {
    if (!text.trim()) return;
    scanRunRef.current?.cleanup();
    scanRunRef.current = null;

    setScanState("scanning");
    setScanDurationMs(undefined);

    const start = performance.now();
    const docEl = docRef.current;
    if (docEl) {
      const editorRoot = docEl.querySelector<HTMLElement>("[data-scan-root]");
      if (editorRoot) {
        const run = runWordScan(editorRoot, SCAN_DURATION_MS, () => {
          run.cleanup();
          scanRunRef.current = null;
          const elapsed = performance.now() - start;
          setResult(mockScan(text));
          setScanState("done");
          setScanDurationMs(elapsed);
        });
        scanRunRef.current = run;
        return;
      }
    }
    const t = setTimeout(() => {
      setResult(mockScan(text));
      setScanState("done");
      setScanDurationMs(performance.now() - start);
    }, SCAN_DURATION_MS);
    scanRunRef.current = { cleanup: () => clearTimeout(t) };
  }, []);

  // Consume any handoff text from /verify or /detect; otherwise seed with
  // the canned student-essay sample so the UI always has something to show.
  useEffect(() => {
    const pending = consumePendingScan();
    const seeded = pending?.text ?? DEFAULT_TEXT;
    setInitialText(seeded);
    if (seeded.trim() !== "") runScan(seeded);
  }, [runScan]);

  useEffect(
    () => () => {
      scanRunRef.current?.cleanup();
    },
    [],
  );

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

  const handleScan = useCallback(() => {
    if (scanState === "scanning") return;
    const text = initialText ?? "";
    if (!text.trim()) return;
    runScan(text);
  }, [initialText, runScan, scanState]);

  const wordCount = useMemo(() => {
    if (!initialText) return 0;
    const t = initialText.trim();
    return t === "" ? 0 : t.split(/\s+/).length;
  }, [initialText]);

  const excerpts = useMemo(() => {
    const out: Record<string, string> = {};
    if (!result || !initialText) return out;
    for (const f of result.flags) {
      out[f.id] = initialText.slice(
        Math.max(0, f.from - 1),
        Math.max(0, f.to - 1),
      );
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
          crumbs={["Library", "Text scans"]}
          docName="student_essay.txt"
          scanState={scanState}
          scanDurationMs={scanDurationMs}
          score={result?.authenticity ?? null}
          collaborators={COLLABORATORS}
        />
      }
      canvas={
        <div className={editorStyles.scroll}>
          <div className={editorStyles.docWrap} ref={docRef}>
            <DocMeta
              filename="student_essay.txt"
              wordCount={wordCount}
              scanState={scanState}
              scanDurationMs={scanDurationMs}
            />
            <article className={editorStyles.doc} data-scan-root>
              <h1 className={editorStyles.title}>
                The role of <em>technology</em> in modern education
              </h1>
              {initialText !== null && (
                <Editor
                  ref={editorRef}
                  initialText={initialText}
                  flags={flags}
                  selectedId={selectedId}
                  onFlagClick={handleSelect}
                />
              )}
            </article>
          </div>
        </div>
      }
      inspector={
        <DetectionPanel
          scanState={scanState}
          result={result}
          selectedId={selectedId}
          onSelect={handleSelect}
          excerpts={excerpts}
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

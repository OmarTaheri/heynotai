"use client";

import { AudioEditorClient } from "@/components/editor/AudioEditorClient";
import { syntheticScan } from "@/lib/scan-types";

const SAMPLE_SRC = "/editor-samples/audio.mp3";

/** Legacy showcase route — renders the audio editor against the bundled
 *  demo asset. Real saved-scan routes go through `/editor/[id]`. */
export default function AudioEditorPage() {
  const scan = syntheticScan({
    type: "aud",
    fileUrl: SAMPLE_SRC,
    durationMs: 45_000,
  });
  return <AudioEditorClient scan={scan} fallbackSrc={SAMPLE_SRC} />;
}

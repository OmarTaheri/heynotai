"use client";

import { VideoEditorClient } from "@/components/editor/VideoEditorClient";
import { syntheticScan } from "@/lib/scan-types";

const SAMPLE_SRC = "/editor-samples/video.mp4";

/** Legacy showcase route — renders the video editor against the bundled
 *  demo asset. Real saved-scan routes go through `/editor/[id]`. */
export default function VideoEditorPage() {
  const scan = syntheticScan({
    type: "vid",
    fileUrl: SAMPLE_SRC,
    durationMs: 30_000,
  });
  return <VideoEditorClient scan={scan} fallbackSrc={SAMPLE_SRC} />;
}

"use client";

import { ImageEditorClient } from "@/components/editor/ImageEditorClient";
import { syntheticScan } from "@/lib/scan-types";

const SAMPLE_SRC = "/editor-samples/image.jpg";

/** Legacy showcase route — renders the image editor against the bundled
 *  demo asset. Real saved-scan routes go through `/editor/[id]`. */
export default function ImageEditorPage() {
  const scan = syntheticScan({ type: "img", fileUrl: SAMPLE_SRC });
  return <ImageEditorClient scan={scan} fallbackSrc={SAMPLE_SRC} />;
}

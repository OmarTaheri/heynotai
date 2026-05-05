/* Detector registry. The route layer asks for a detector by `ScanKind`
 * (txt/img/aud/vid) and an optional `provider` — model rows in
 * `detection_models` are data, not code, so adding a new HF model is
 * a PB insert, no compile required.
 *
 * Provider routing: by default everything lands on Hugging Face's
 * `hf-inference` router. Audio is the exception — HF's free serverless
 * tier doesn't host audio-classification models, so audio rows in PB
 * are seeded with `provider: "velma"` and dispatched to Modulate. */

import { detect as hfText } from "./hf-text.js";
import { detect as hfImage } from "./hf-image.js";
import { detect as hfAudio } from "./hf-audio.js";
import { detect as hfVideo } from "./hf-video.js";
import { detect as velmaAudio } from "./velma-audio.js";
import type {
  DetectorInput,
  DetectorProvider,
  DetectorResult,
  ModelConfig,
  ScanKind,
} from "./types.js";

export type Detector = (input: DetectorInput, cfg: ModelConfig) => Promise<DetectorResult>;

const BY_KIND: Record<ScanKind, Detector> = {
  txt: hfText,
  img: hfImage,
  aud: hfAudio,
  vid: hfVideo,
};

export function getDetector(kind: ScanKind, provider?: DetectorProvider): Detector {
  if (kind === "aud" && provider === "velma") return velmaAudio;
  return BY_KIND[kind];
}

/** Back-compat shim — prefer `getDetector(kind, provider)`. */
export function getDetectorForKind(kind: ScanKind): Detector {
  return BY_KIND[kind];
}

export type {
  DetectorInput,
  DetectorProvider,
  DetectorResult,
  ModelConfig,
  ScanKind,
} from "./types.js";
export { DetectorError } from "./types.js";

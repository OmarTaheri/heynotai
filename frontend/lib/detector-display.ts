/** Map a scan's `engineId` slug to a human-readable detector name for
 *  the collection items table. Falls back to the scan's top-level
 *  `model` field when the engine slug is empty/unknown. */

const NAMES: Record<string, string> = {
  sapling: "Sapling",
  gptzero: "GPTZero",
  originality: "Originality.ai",
  "openai-detector": "OpenAI Detector",
  "hf-roberta": "RoBERTa (HF)",
  sightengine: "Sightengine",
};

export function detectorDisplayName(
  engineId: string,
  modelFallback: string,
): string {
  if (engineId && NAMES[engineId]) return NAMES[engineId];
  if (engineId) {
    return engineId
      .replace(/[-_]/g, " ")
      .replace(/\b\w/g, (c) => c.toUpperCase());
  }
  return modelFallback || "—";
}

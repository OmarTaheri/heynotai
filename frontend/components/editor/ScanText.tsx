interface Props {
  text: string;
  perWordMs?: number;
  pulseMs?: number;
}

export const SCAN_PER_WORD_MS = 70;
export const SCAN_PULSE_MS = 700;

/** Mirrors `textToDoc` in Editor.tsx — every newline run is a paragraph
 *  break. Keeps the scanning view's shape in lockstep with the final
 *  editor render so paragraphs don't snap around the moment the
 *  animation finishes. */
export function ScanText({
  text,
  perWordMs = SCAN_PER_WORD_MS,
  pulseMs = SCAN_PULSE_MS,
}: Props) {
  const lines = text.split(/\n+/);
  let wordIndex = 0;
  return (
    <div className="editor-prose scan-text" aria-hidden>
      {lines.map((line, li) => (
        <p key={li}>
          {line.split(/(\s+)/).map((tok, i) => {
            if (tok === "") return null;
            if (/^\s+$/.test(tok)) return <span key={i}>{tok}</span>;
            const delay = wordIndex++ * perWordMs;
            return (
              <span
                key={i}
                className="scan-word"
                style={{
                  animationDelay: `${delay}ms`,
                  animationDuration: `${pulseMs}ms`,
                }}
              >
                {tok}
              </span>
            );
          })}
        </p>
      ))}
    </div>
  );
}

export function scanDurationMs(text: string): number {
  const wordCount = text.trim() === "" ? 0 : text.trim().split(/\s+/).length;
  return Math.min(
    8000,
    Math.max(1800, wordCount * SCAN_PER_WORD_MS + SCAN_PULSE_MS + 200),
  );
}

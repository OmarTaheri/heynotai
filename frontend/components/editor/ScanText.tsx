interface Props {
  text: string;
  perWordMs?: number;
  pulseMs?: number;
}

export const SCAN_PER_WORD_MS = 70;
export const SCAN_PULSE_MS = 700;

export function ScanText({
  text,
  perWordMs = SCAN_PER_WORD_MS,
  pulseMs = SCAN_PULSE_MS,
}: Props) {
  const paragraphs = text.split(/\n+/);
  let wordIndex = 0;
  return (
    <div className="editor-prose scan-text" aria-hidden>
      {paragraphs.map((p, pi) => (
        <p key={pi}>
          {p.split(/(\s+)/).map((tok, i) => {
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

import type { ReactNode } from "react";
import { Pill } from "./Pill";

export function Process() {
  return (
    <section className="mx-auto max-w-5xl px-6 py-20 text-center">
      <Pill>Simple process with quick results</Pill>

      <h2 className="mx-auto mt-6 max-w-3xl text-4xl font-semibold leading-[1.1] tracking-tight sm:text-5xl">
        <span className="text-white">heynotai makes AI</span>{" "}
        <span className="text-white/40">Content</span>
        <br />
        <span className="text-white">Detection fast,</span>{" "}
        <span className="text-white/40">reliable,</span>{" "}
        <span className="text-white">and easy</span>
      </h2>

      <div className="mt-12 rounded-[32px] border border-[var(--color-line)] bg-[var(--color-surface)] p-6 sm:p-10">
        <div className="flex flex-col items-stretch gap-5 sm:flex-row sm:items-center sm:gap-4">
          <StepPill>Upload or Paste Your Text</StepPill>
          <ProcessArrow />
          <FolderArt />
          <ProcessArrow />
          <StepPill leading={<FourPointSparkle size={15} />}>
            Generate result
          </StepPill>
        </div>

        <p className="mt-8 text-center text-[12.5px] text-white/55">
          Instant results: &ldquo;AI likelihood: 87% — Detailed report
          available after sign-up&rdquo;
        </p>
      </div>
    </section>
  );
}

function StepPill({
  children,
  leading,
}: {
  children: ReactNode;
  leading?: ReactNode;
}) {
  return (
    <div className="flex flex-1 items-center justify-center gap-2.5 rounded-full bg-[#e6ecf2] px-6 py-5 text-[15px] font-medium text-[#15171b]">
      {leading}
      <span>{children}</span>
    </div>
  );
}

function ProcessArrow() {
  return (
    <span className="hidden flex-shrink-0 self-center text-white/40 sm:inline">
      <svg
        width="32"
        height="14"
        viewBox="0 0 32 14"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.5"
        strokeLinecap="round"
        strokeLinejoin="round"
        aria-hidden
      >
        <path d="M2 7h26" />
        <path d="M22 2l5 5-5 5" />
      </svg>
    </span>
  );
}

/** Yellow folder card — central visual in the process row. The little
    tab on top-left (the darker overlay) sells the "folder" silhouette,
    and the three horizontal lines read as document content inside. */
function FolderArt() {
  return (
    <div className="mx-auto flex h-[120px] w-[120px] flex-shrink-0 items-center justify-center self-center rounded-[18px] bg-[#e8d77a] p-3 shadow-[0_8px_24px_rgba(0,0,0,0.3)]">
      <svg viewBox="0 0 64 56" width="92" height="80" aria-hidden>
        {/* Folder back/body */}
        <path
          d="M4 14c0-3 2-5 5-5h14l5 6h27c3 0 5 2 5 5v26c0 3-2 5-5 5H9c-3 0-5-2-5-5V14z"
          fill="#f1e493"
          stroke="#9c8528"
          strokeWidth="1.6"
          strokeLinejoin="round"
        />
        {/* Folder tab shadow (the back fold under the lid) */}
        <path
          d="M4 14c0-3 2-5 5-5h14l5 6H4z"
          fill="#d8c45e"
          stroke="#9c8528"
          strokeWidth="1.6"
          strokeLinejoin="round"
        />
        {/* Document text lines */}
        <g stroke="#9c8528" strokeWidth="2.2" strokeLinecap="round">
          <path d="M13 28h38" />
          <path d="M13 35h38" />
          <path d="M13 42h26" />
        </g>
      </svg>
    </div>
  );
}

function FourPointSparkle({ size = 14 }: { size?: number }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="currentColor"
      aria-hidden
    >
      <path d="M12 2 C12 8 16 12 22 12 C16 12 12 16 12 22 C12 16 8 12 2 12 C8 12 12 8 12 2 Z" />
    </svg>
  );
}

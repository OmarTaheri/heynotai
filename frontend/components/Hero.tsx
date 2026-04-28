"use client";

import { useEffect, useRef, useState } from "react";
import type { ReactNode } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Icon, type IconName } from "./Icon";
import { Button } from "./Button";
import { BrowserInstallButton } from "./BrowserInstallButton";
import { setPendingScan } from "@/lib/scanHandoff";

const MAX = 5000;

export function Hero() {
  const [text, setText] = useState("");

  return (
    <section className="relative overflow-hidden pb-24 pt-32 md:pt-40">
      {/* Hero aurora — blue bloom with greenish edges and a field of dark
          "holes" that drift + fade in/out so the whole thing reads like a
          slow-moving fluid. Each <span> is styled individually via
          :nth-child selectors; two small blue blobs plus six holes of
          varying sizes create the layered texture. The whole bloom also
          drifts toward the cursor via --mx / --my CSS custom properties. */}
      <div className="hero-aurora" aria-hidden>
        <span />
        <span />
        <span />
        <span />
        <span />
        <span />
        <span />
        <span />
      </div>

      <div className="relative mx-auto max-w-7xl px-6 text-center">
        <h1 className="mx-auto max-w-5xl text-6xl font-semibold leading-[1.02] tracking-tight sm:text-7xl md:text-8xl">
          <span className="block whitespace-nowrap">
            <span className="text-white">Hey.</span>{" "}
            <span className="text-white/45">That&apos;s not</span>{" "}
            <span className="text-white">human.</span>
          </span>
        </h1>

        <p className="mx-auto mt-7 max-w-xl text-[13.5px] leading-relaxed text-white/65">
          heynotai catches AI across text, images, audio, and video —
          essays, headshots, voice notes, deepfakes, and anything else
          you can read, write, or upload.
        </p>

        <DetectorCard text={text} setText={setText} />
      </div>
    </section>
  );
}

function DetectorCard({
  text,
  setText,
}: {
  text: string;
  setText: (v: string) => void;
}) {
  const router = useRouter();
  const wordCount =
    text.trim() === "" ? 0 : text.trim().split(/\s+/).length;

  const goToEditor = () => {
    setPendingScan(text);
    router.push("/editor");
  };

  return (
    <div className="relative mx-auto mt-12 w-full max-w-6xl">
      {/* Only the AI Detector tab gets wrapped in a .tab-bump — the bump
          draws a card-colored extension above the card's top edge, so the
          card appears to grow up around the active tab (matching reference). */}
      <div className="tab-row relative z-30 flex items-end justify-center gap-3 sm:gap-4">
        <Link href="#signup" className="hero-tab hero-tab-text hero-tab-equal">
          Get Started for free
          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
            <path d="M7 17L17 7M9 7h8v8" />
          </svg>
        </Link>
        <div className="tab-bump">
          <Link href="#demo" className="hero-tab hero-tab-blue hero-tab-equal">
            AI Detector
            <FourPointSparkle size={13} />
          </Link>
        </div>
      </div>

      {/* Demo card — dark squircle holding the textarea on top and the
          cream action toolbar nested at the bottom inside the same card.
          Card padding is tightened so the toolbar sits close to the
          card's bottom edge with a small inset on each side. */}
      <div
        id="demo"
        className="squircle relative bg-[var(--color-surface)] px-4 pb-4 pt-6 text-left shadow-[0_30px_80px_rgba(0,0,0,0.55)] sm:px-5 sm:pb-5 sm:pt-7"
      >
        <textarea
          value={text}
          onChange={(e) => setText(e.target.value.slice(0, MAX))}
          placeholder="Enter suspected AI text here..."
          className="h-64 w-full resize-none bg-transparent px-3 text-[13.5px] text-white placeholder:text-white/50 focus:outline-none"
        />

        {/* Action toolbar nested INSIDE the card at the bottom. Cream
            pill with the same token-flipping treatment as the install
            strip below, so descendant <Button>s read light-mode colors.
            Dropdowns open downward; the install strip is the next
            sibling so there's room for them to expand into. */}
        <div className="action-bar mt-4">
          <div className="action-bar-inner">
            <div className="flex flex-wrap items-center gap-2">
              <Button
                variant="green"
                size="sm"
                leftIcon={<FourPointSparkle size={13} />}
                onClick={goToEditor}
                disabled={text.trim() === ""}
              >
                Detect AI Content
              </Button>

              <ActionMenu
                label="Upload"
                leftIcon={<Icon name="upload" size={13} />}
                direction="down"
                items={[
                  { icon: "text", label: "Document (.pdf, .docx, .txt)" },
                  { icon: "image", label: "Image (.png, .jpg, .webp)" },
                  { icon: "audio", label: "Audio (.mp3, .wav, .m4a)" },
                  { icon: "video", label: "Video (.mp4, .mov)" },
                ]}
              />

              <ActionMenu
                label="From link"
                leftIcon={<Icon name="link" size={13} />}
                direction="down"
                items={[
                  { icon: "play", label: "YouTube video" },
                  { icon: "video", label: "TikTok video" },
                  { icon: "globe", label: "X / Twitter post" },
                  { icon: "globe", label: "Reddit post" },
                  { icon: "link", label: "Custom URL" },
                ]}
              />

              <button
                type="button"
                onClick={() => setText("")}
                className="inline-flex h-8 items-center gap-1.5 rounded-[8px] px-2.5 text-[12.5px] font-medium text-[var(--color-fg-mid)] transition-colors hover:bg-[rgba(255,255,255,0.06)] hover:text-[var(--color-fg)]"
              >
                <BroomIcon />
                Clear text
              </button>
            </div>

            <div className="ml-auto font-mono text-[12.5px] text-[var(--color-fg-dim)] tabular-nums">
              {text.length === 0 ? (
                <span>0/{MAX}</span>
              ) : (
                <span>
                  <span className="text-[var(--color-fg)] font-semibold">
                    {wordCount}
                  </span>{" "}
                  word{wordCount === 1 ? "" : "s"} ·{" "}
                  <span className="text-[var(--color-fg)] font-semibold">
                    {text.length}
                  </span>
                  /{MAX}
                </span>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Install strip — restored below the textbox. Rainbow-bordered
          cream pill (same .result-strip the page already ships) with a
          one-line pitch on the left and the browser-aware install
          button on the right. Full-width so it aligns with the card. */}
      <div className="result-strip mt-5 w-full">
        <div className="result-strip-inner">
          <div className="flex min-w-0 items-center gap-3">
            <span className="inline-flex h-6 w-6 flex-shrink-0 items-center justify-center text-[var(--color-fg)]">
              <FourPointSparkle size={18} />
            </span>
            <p className="truncate text-[13.5px] font-medium text-[var(--color-fg)] sm:text-sm">
              Over <span className="font-semibold">57%</span> of the
              internet is AI-generated — don&apos;t be the one deceived.
            </p>
          </div>
          <BrowserInstallButton />
        </div>
      </div>
    </div>
  );
}

type ActionItem = {
  icon: IconName;
  label: string;
  onClick?: () => void;
};

/** Small dropdown used for the Upload + From-link pickers. Opens upward
    (the strip sits near the bottom of the viewport), closes on outside
    click or Escape. Purely visual today — items don't wire to a real
    upload flow yet. */
function ActionMenu({
  label,
  leftIcon,
  items,
  direction = "up",
}: {
  label: string;
  leftIcon?: ReactNode;
  items: ActionItem[];
  direction?: "up" | "down";
}) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const onClick = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) {
        setOpen(false);
      }
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setOpen(false);
    };
    document.addEventListener("mousedown", onClick);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onClick);
      document.removeEventListener("keydown", onKey);
    };
  }, [open]);

  return (
    <div ref={ref} className="relative">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-haspopup="menu"
        aria-expanded={open}
        className="inline-flex h-8 items-center gap-1.5 rounded-[8px] border border-[var(--color-line-strong)] bg-[var(--color-surface)] px-3 text-[12.5px] font-medium text-[var(--color-fg)] transition-colors hover:bg-[rgba(255,255,255,0.04)]"
      >
        {leftIcon}
        {label}
        <Icon name="chevron-down" size={11} />
      </button>

      {open && (
        <div
          role="menu"
          className={`absolute left-0 z-20 min-w-[220px] rounded-[12px] border border-[var(--color-line-strong)] bg-[var(--color-surface)] p-1 shadow-[0_12px_32px_rgba(0,0,0,0.45)] ${
            direction === "up" ? "bottom-full mb-2" : "top-full mt-2"
          }`}
        >
          {items.map((item) => (
            <button
              key={item.label}
              type="button"
              role="menuitem"
              onClick={() => {
                item.onClick?.();
                setOpen(false);
              }}
              className="flex w-full items-center gap-2.5 rounded-[8px] px-2.5 py-2 text-left text-[12.5px] text-[var(--color-fg)] transition-colors hover:bg-[rgba(255,255,255,0.06)]"
            >
              <span className="flex h-6 w-6 flex-shrink-0 items-center justify-center rounded-[6px] bg-[rgba(255,255,255,0.06)] text-[var(--color-fg-mid)]">
                <Icon name={item.icon} size={12} />
              </span>
              {item.label}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

/** 4-point sparkle / diamond — concave-sided star used as the AI Detector
    brand mark. Filled (not stroked) so the silhouette reads cleanly even at
    13–18px, matching the reference. */
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

/** Minimal broom/brush icon for the "Clear text" action — matches the
    reference without requiring a new entry in the shared Icon set. */
function BroomIcon() {
  return (
    <svg
      width="13"
      height="13"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.8"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden
    >
      <path d="M14 4l6 6" />
      <path d="M17 7l-9 9-4 4 4-4 9-9" />
      <path d="M8 16l2 4 6-2-2-6" />
    </svg>
  );
}

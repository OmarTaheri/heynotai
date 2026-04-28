import type { ReactNode } from "react";

/* ── Trust strip ──
   A centered subtitle plus an infinite horizontal marquee of brand marks.
   The marquee DOM is intentionally `[track][track]` — two identical
   copies of the same content inside one animated `.marquee` element.
   The CSS translates the outer element by exactly -50%, which maps onto
   one full `.marquee-track` width (plus its trailing padding), so the
   loop is seamless: the moment we hit -50% the animation resets to 0,
   and because track 2 was at screen-position = track 1's start, the
   viewer never sees a jump. */

type Logo = { name: string; mark: ReactNode };

const LOGOS: Logo[] = [
  { name: "Vercel",    mark: <VercelMark /> },
  { name: "Linear",    mark: <LinearMark /> },
  { name: "Notion",    mark: <NotionMark /> },
  { name: "Stripe",    mark: <StripeMark /> },
  { name: "Figma",     mark: <FigmaMark /> },
  { name: "GitHub",    mark: <GitHubMark /> },
  { name: "OpenAI",    mark: <OpenAIMark /> },
  { name: "Anthropic", mark: <AnthropicMark /> },
  { name: "Replit",    mark: <ReplitMark /> },
];

export function TrustedBy() {
  return (
    <section className="relative pb-10 pt-4">
      <p className="mb-8 text-center text-[15px] font-medium text-[var(--color-fg-mid)]">
        Trusted by worldwide leading companies
      </p>

      <div className="overflow-hidden [mask-image:linear-gradient(90deg,transparent,black_10%,black_90%,transparent)]">
        <div className="marquee">
          <MarqueeTrack />
          <MarqueeTrack ariaHidden />
        </div>
      </div>
    </section>
  );
}

/* Each track renders the logo set TWICE inline. Reason: if a single
   track is narrower than the viewport, the right edge of the marquee
   leaves the viewport before the -50% loop point, so you see a blank
   strip pop in from the right. Duplicating inside each track guarantees
   one track is wider than any reasonable viewport, so the right side
   always has content scrolling in. The seamless -50% loop still works
   because both tracks are still identical to each other. */
function MarqueeTrack({ ariaHidden }: { ariaHidden?: boolean }) {
  return (
    <div className="marquee-track" aria-hidden={ariaHidden}>
      {LOGOS.map((logo) => (
        <LogoItem key={`a-${logo.name}`} {...logo} />
      ))}
      {LOGOS.map((logo) => (
        <LogoItem key={`b-${logo.name}`} {...logo} />
      ))}
    </div>
  );
}

function LogoItem({ name, mark }: Logo) {
  return (
    <span className="inline-flex flex-shrink-0 items-center gap-2.5 text-[22px] font-semibold tracking-tight text-[var(--color-fg)]/55 transition-opacity hover:text-[var(--color-fg)]/90">
      <span className="inline-flex h-6 w-6 items-center justify-center">
        {mark}
      </span>
      {name}
    </span>
  );
}

/* ── Brand marks ──
   Monochrome simplifications of each logo, sized for ~22px. They all use
   currentColor so they inherit the muted trust-strip tone (and hover
   brightening) from the surrounding <span>. */

function VercelMark() {
  return (
    <svg width="22" height="22" viewBox="0 0 24 24" fill="currentColor" aria-hidden>
      <path d="M12 4 22 20 2 20 Z" />
    </svg>
  );
}

function LinearMark() {
  return (
    <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" aria-hidden>
      <path d="M3 15 15 3" />
      <path d="M3 21 21 3" />
      <path d="M9 21 21 9" />
      <path d="M15 21 21 15" />
    </svg>
  );
}

function NotionMark() {
  return (
    <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinejoin="round" aria-hidden>
      <rect x="3" y="3" width="18" height="18" rx="2.5" />
      <path d="M8 17V7l8 10V7" />
    </svg>
  );
}

function StripeMark() {
  return (
    <svg width="22" height="22" viewBox="0 0 24 24" fill="currentColor" aria-hidden>
      <path d="M13.5 9.6c0-.7.6-1 1.6-1 1.4 0 3.2.4 4.6 1.2V5.5c-1.5-.6-3-.9-4.6-.9-3.8 0-6.3 2-6.3 5.2 0 5.2 7.2 4.4 7.2 6.6 0 .9-.7 1.1-1.8 1.1-1.5 0-3.5-.6-5.1-1.5v4.4c1.7.7 3.5 1 5.1 1 3.9 0 6.5-1.9 6.5-5.3 0-5.5-7.2-4.6-7.2-6.5z" />
    </svg>
  );
}

function FigmaMark() {
  return (
    <svg width="22" height="22" viewBox="0 0 24 24" fill="currentColor" aria-hidden>
      <path d="M8.5 2h3.5v8H8.5a4 4 0 1 1 0-8z" />
      <path d="M12 2h3.5a4 4 0 0 1 0 8H12V2z" />
      <path d="M12 10h3.5a4 4 0 0 1 0 8H12v-8z" opacity="0.7" />
      <path d="M8.5 10H12v8H8.5a4 4 0 1 1 0-8z" opacity="0.55" />
      <path d="M8.5 18H12v-4a4 4 0 1 1-3.5 4z" opacity="0.4" />
    </svg>
  );
}

function GitHubMark() {
  return (
    <svg width="22" height="22" viewBox="0 0 24 24" fill="currentColor" aria-hidden>
      <path d="M12 2C6.5 2 2 6.6 2 12.2c0 4.5 2.9 8.3 6.8 9.6.5.1.7-.2.7-.5v-1.8c-2.8.6-3.4-1.3-3.4-1.3-.4-1.2-1.1-1.5-1.1-1.5-.9-.6.1-.6.1-.6 1 .1 1.5 1.1 1.5 1.1.9 1.6 2.4 1.1 3 .9.1-.7.4-1.1.6-1.4-2.2-.3-4.6-1.1-4.6-5 0-1.1.4-2 1-2.7-.1-.3-.4-1.4.1-2.8 0 0 .8-.3 2.7 1a9 9 0 0 1 5 0c1.9-1.3 2.7-1 2.7-1 .5 1.4.2 2.5.1 2.8.6.7 1 1.6 1 2.7 0 3.9-2.4 4.7-4.6 5 .4.3.7.9.7 1.8v2.7c0 .3.2.6.7.5 4-1.3 6.8-5.1 6.8-9.6C22 6.6 17.5 2 12 2z" />
    </svg>
  );
}

function OpenAIMark() {
  return (
    <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinejoin="round" aria-hidden>
      <path d="M12 3a4 4 0 0 1 4 4v3" />
      <path d="M12 3a4 4 0 0 0-4 4v3" />
      <path d="M5.2 8a4 4 0 0 1 2.8-1" />
      <path d="M18.8 8a4 4 0 0 0-2.8-1" />
      <path d="M5.2 16a4 4 0 0 0 2.8 1" />
      <path d="M18.8 16a4 4 0 0 1-2.8 1" />
      <path d="M12 21a4 4 0 0 1-4-4v-3" />
      <path d="M12 21a4 4 0 0 0 4-4v-3" />
      <circle cx="12" cy="12" r="2.2" fill="currentColor" />
    </svg>
  );
}

function AnthropicMark() {
  return (
    <svg width="22" height="22" viewBox="0 0 24 24" fill="currentColor" aria-hidden>
      <path d="M7.3 3 2 21h3.2l1.1-3.8h5.1L12.5 21h3.2L10.5 3H7.3zm-.2 11.2 1.7-6 1.7 6h-3.4zM16 3l5.5 18h-3.3L12.7 3H16z" />
    </svg>
  );
}

function ReplitMark() {
  return (
    <svg width="22" height="22" viewBox="0 0 24 24" fill="currentColor" aria-hidden>
      <rect x="3" y="3" width="9" height="9" rx="1.8" />
      <rect x="12" y="12" width="9" height="9" rx="1.8" />
      <rect x="3" y="12" width="9" height="9" rx="1.8" opacity="0.5" />
    </svg>
  );
}

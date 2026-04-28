import type { MonitorKind } from "@/lib/monitors-data";

/**
 * Square brand-tile for a monitor kind. Pure presentational — used by
 * MonitorCard's left avatar slot and the MonitorTemplates grid. Logos
 * are inline SVG so the page stays a server component (no <Image>
 * round-trips). Sizes auto-fit the parent (`size` prop in px).
 */
export function MonitorTypeIcon({
  kind,
  size = 42,
}: {
  kind: MonitorKind;
  size?: number;
}) {
  const cls = `mon-fav mon-fav-${kind}`;
  const inner = Math.round(size * 0.52);
  return (
    <span
      className={cls}
      style={{ width: size, height: size }}
      aria-hidden
    >
      {LOGOS[kind](inner)}
    </span>
  );
}

const LOGOS: Record<MonitorKind, (s: number) => React.ReactElement> = {
  youtube: (s) => (
    <svg viewBox="0 0 24 24" width={s} height={s} fill="currentColor">
      <path d="M21.58 7.19c-.23-.86-.91-1.54-1.77-1.77C18.25 5 12 5 12 5s-6.25 0-7.81.42a2.5 2.5 0 0 0-1.77 1.77C2 8.75 2 12 2 12s0 3.25.42 4.81c.23.86.91 1.54 1.77 1.77C5.75 19 12 19 12 19s6.25 0 7.81-.42a2.5 2.5 0 0 0 1.77-1.77C22 15.25 22 12 22 12s0-3.25-.42-4.81zM10 15V9l5 3-5 3z" />
    </svg>
  ),
  x: (s) => (
    <svg viewBox="0 0 24 24" width={Math.round(s * 0.85)} height={Math.round(s * 0.85)} fill="currentColor">
      <path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-5.214-6.817L4.99 21.75H1.68l7.73-8.835L1.254 2.25H8.08l4.713 6.231zm-1.161 17.52h1.833L7.084 4.126H5.117z" />
    </svg>
  ),
  rss: (s) => (
    <svg viewBox="0 0 24 24" width={s} height={s} fill="none" stroke="currentColor" strokeWidth={2.5} strokeLinecap="round" strokeLinejoin="round">
      <path d="M4 11a9 9 0 0 1 9 9M4 4a16 16 0 0 1 16 16" />
      <circle cx="5" cy="19" r="1" fill="currentColor" />
    </svg>
  ),
  folder: (s) => (
    <svg viewBox="0 0 24 24" width={s} height={s} fill="currentColor">
      <path d="M10 4H4a2 2 0 0 0-2 2v12a2 2 0 0 0 2 2h16a2 2 0 0 0 2-2V8a2 2 0 0 0-2-2h-8z" />
    </svg>
  ),
  url: (s) => (
    <svg viewBox="0 0 24 24" width={s} height={s} fill="none" stroke="currentColor" strokeWidth={2.5} strokeLinecap="round" strokeLinejoin="round">
      <path d="M10 13a5 5 0 0 0 7.54.54l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.71" />
      <path d="M14 11a5 5 0 0 0-7.54-.54l-3 3a5 5 0 0 0 7.07 7.07l1.71-1.71" />
    </svg>
  ),
  telegram: (s) => (
    <svg viewBox="0 0 24 24" width={s} height={s} fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
      <path d="M22 2L11 13M22 2l-7 20-4-9-9-4 20-7z" />
    </svg>
  ),
};

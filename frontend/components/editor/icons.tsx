/**
 * Editor-specific glyphs that aren't in the shared `<Icon>` set
 * (Compare, Duplicate, Export, Format, Speaker, Style, Scan, ChevronUp).
 * Anything available via `<Icon name="…">` should be imported from
 * `@/components/Icon` instead — this file is for the gaps.
 */
import type { SVGProps } from "react";

type Props = SVGProps<SVGSVGElement> & { size?: number };

const base = (size: number, props: SVGProps<SVGSVGElement>) => ({
  width: size,
  height: size,
  viewBox: "0 0 24 24",
  fill: "none",
  stroke: "currentColor",
  strokeWidth: 1.8,
  strokeLinecap: "round" as const,
  strokeLinejoin: "round" as const,
  ...props,
});

export const ChevronUp = ({ size = 16, ...p }: Props) => (
  <svg {...base(size, p)}><polyline points="18 15 12 9 6 15" /></svg>
);
export const Speaker = ({ size = 16, ...p }: Props) => (
  <svg {...base(size, p)}>
    <polygon points="11 5 6 9 2 9 2 15 6 15 11 19 11 5" />
    <path d="M15 9a3 3 0 0 1 0 6" />
    <path d="M19 6a8 8 0 0 1 0 12" />
  </svg>
);
export const Style = ({ size = 16, ...p }: Props) => (
  <svg {...base(size, p)}><path d="M5 4h14" /><path d="M9 4v16" /><path d="M15 4v16" /></svg>
);
export const Format = ({ size = 16, ...p }: Props) => (
  <svg {...base(size, p)}>
    <path d="M4 7V5a1 1 0 0 1 1-1h14a1 1 0 0 1 1 1v2" />
    <path d="M9 20h6" />
    <path d="M12 4v16" />
  </svg>
);
export const Compare = ({ size = 16, ...p }: Props) => (
  <svg {...base(size, p)}>
    <rect x="3" y="4" width="8" height="16" rx="1.5" />
    <rect x="13" y="4" width="8" height="16" rx="1.5" />
  </svg>
);
export const Duplicate = ({ size = 16, ...p }: Props) => (
  <svg {...base(size, p)}>
    <rect x="8" y="8" width="13" height="13" rx="2" />
    <path d="M16 8V5a2 2 0 0 0-2-2H5a2 2 0 0 0-2 2v9a2 2 0 0 0 2 2h3" />
  </svg>
);
export const Export = ({ size = 16, ...p }: Props) => (
  <svg {...base(size, p)}>
    <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
    <polyline points="7 10 12 15 17 10" />
    <line x1="12" y1="15" x2="12" y2="3" />
  </svg>
);
export const Scan = ({ size = 16, ...p }: Props) => (
  <svg {...base(size, p)}>
    <path d="M21 12a9 9 0 1 1-3-6.7" />
    <path d="M21 4v5h-5" />
    <circle cx="12" cy="12" r="2" />
  </svg>
);

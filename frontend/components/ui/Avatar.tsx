type Size = "sm" | "md" | "lg";

const SIZE_PX: Record<Size, number> = {
  sm: 28,
  md: 36,
  lg: 56,
};

const FONT_PX: Record<Size, number> = {
  sm: 11,
  md: 13,
  lg: 20,
};

/**
 * Round avatar with initials. Color is hashed from the initials so two
 * different users get two different tints without us having to track
 * a palette per user.
 */
export function Avatar({
  initials,
  size = "md",
}: {
  initials: string;
  size?: Size;
}) {
  const px = SIZE_PX[size];
  const hue = hashHue(initials);
  return (
    <span
      className="inline-flex items-center justify-center rounded-full font-semibold text-white"
      style={{
        width: px,
        height: px,
        fontSize: FONT_PX[size],
        background: `linear-gradient(135deg, oklch(0.62 0.16 ${hue}), oklch(0.5 0.18 ${(hue + 25) % 360}))`,
        flexShrink: 0,
      }}
      aria-hidden
    >
      {initials.slice(0, 2).toUpperCase()}
    </span>
  );
}

function hashHue(seed: string): number {
  let h = 0;
  for (let i = 0; i < seed.length; i++) h = (h * 31 + seed.charCodeAt(i)) | 0;
  return Math.abs(h) % 360;
}

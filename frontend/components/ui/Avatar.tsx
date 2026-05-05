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
 * Round avatar with initials. When `src` is provided we render the image
 * instead — falling back to the initials avatar if the image fails to
 * load. Initial color is hashed from the initials so two different users
 * get two different tints without us tracking a palette.
 */
export function Avatar({
  initials,
  size = "md",
  src,
}: {
  initials: string;
  size?: Size;
  src?: string | null;
}) {
  const px = SIZE_PX[size];
  const hue = hashHue(initials);
  const baseClass =
    "inline-flex items-center justify-center rounded-full font-semibold text-white overflow-hidden";
  const baseStyle = {
    width: px,
    height: px,
    fontSize: FONT_PX[size],
    background: `linear-gradient(135deg, oklch(0.62 0.16 ${hue}), oklch(0.5 0.18 ${(hue + 25) % 360}))`,
    flexShrink: 0,
  } as const;
  if (src) {
    return (
      <span className={baseClass} style={baseStyle} aria-hidden>
        <img
          src={src}
          alt=""
          width={px}
          height={px}
          style={{ width: "100%", height: "100%", objectFit: "cover" }}
        />
      </span>
    );
  }
  return (
    <span className={baseClass} style={baseStyle} aria-hidden>
      {initials.slice(0, 2).toUpperCase()}
    </span>
  );
}

function hashHue(seed: string): number {
  let h = 0;
  for (let i = 0; i < seed.length; i++) h = (h * 31 + seed.charCodeAt(i)) | 0;
  return Math.abs(h) % 360;
}

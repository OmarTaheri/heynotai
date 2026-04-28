"use client";

import { Icon } from "@/components/Icon";

/**
 * One filter dropdown trigger (Type / Verdict / Confidence / Date /
 * Collection). Visual state only — opening the menu itself is not in
 * scope yet; the chip just paints the current selection summary.
 */
export function FilterChip({
  label,
  value,
  active,
  onClick,
}: {
  label: string;
  value?: string;
  active?: boolean;
  onClick?: () => void;
}) {
  return (
    <button
      type="button"
      className={`lib-fchip${active ? " is-active" : ""}`}
      onClick={onClick}
    >
      <span>{label}</span>
      {value && <span className="lib-fchip-val">{value}</span>}
      <Icon name="chevron-down" size={12} />
    </button>
  );
}

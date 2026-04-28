import type { ReactNode } from "react";

/* High-contrast white eyebrow pill — the brand's standard label tag,
   used above every section heading. Replaces the older `.section-tag`
   class so all eyebrows share one component (and one set of size,
   color, and spacing tokens). */
export function Pill({
  children,
  className = "",
}: {
  children: ReactNode;
  className?: string;
}) {
  return (
    <span
      className={`inline-flex items-center gap-1.5 rounded-full bg-white px-4 py-1.5 text-[12.5px] font-medium text-[#15171b] ${className}`}
    >
      {children}
    </span>
  );
}

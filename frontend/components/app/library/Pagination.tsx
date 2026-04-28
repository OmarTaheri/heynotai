"use client";

import { Icon } from "@/components/Icon";

/**
 * Compact pager — prev / numbered pages / ellipsis / next. Builds the
 * page list with first, last, current ±1, collapsing the rest into "…".
 */
export function Pagination({
  page,
  pageCount,
  onChange,
}: {
  page: number;
  pageCount: number;
  onChange: (next: number) => void;
}) {
  const pages = buildPageList(page, pageCount);

  return (
    <div className="lib-pager" role="navigation" aria-label="Pagination">
      <button
        type="button"
        className="lib-pager-btn"
        disabled={page <= 1}
        onClick={() => onChange(page - 1)}
        aria-label="Previous page"
      >
        <Icon name="chevron-left" size={12} />
      </button>

      {pages.map((p, i) =>
        p === "…" ? (
          <span key={`gap-${i}`} className="lib-pager-ellipsis">
            …
          </span>
        ) : (
          <button
            key={p}
            type="button"
            className={`lib-pager-btn${p === page ? " is-active" : ""}`}
            onClick={() => onChange(p)}
            aria-current={p === page ? "page" : undefined}
          >
            {p}
          </button>
        ),
      )}

      <button
        type="button"
        className="lib-pager-btn"
        disabled={page >= pageCount}
        onClick={() => onChange(page + 1)}
        aria-label="Next page"
      >
        <Icon name="chevron-right" size={12} />
      </button>
    </div>
  );
}

function buildPageList(page: number, total: number): (number | "…")[] {
  if (total <= 7) return Array.from({ length: total }, (_, i) => i + 1);
  const set = new Set<number>([1, total, page - 1, page, page + 1]);
  const sorted = [...set].filter((n) => n >= 1 && n <= total).sort((a, b) => a - b);
  const out: (number | "…")[] = [];
  for (let i = 0; i < sorted.length; i++) {
    if (i > 0 && sorted[i] - sorted[i - 1] > 1) out.push("…");
    out.push(sorted[i]);
  }
  return out;
}

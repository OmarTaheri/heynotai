"use client";

import { useMemo, useState } from "react";
import { PageHeader } from "@/components/ui/PageHeader";
import { Button } from "@/components/ui/Button";
import { SearchInput } from "@/components/ui/SearchInput";
import { FilterChip } from "@/components/ui/FilterChip";
import { Icon } from "@/components/Icon";
import { REPORTS, type Report } from "@/lib/reports-data";
import { TemplateGrid } from "./TemplateGrid";
import { ReportsTable } from "./ReportsTable";
import { ReportsQuota } from "./ReportsQuota";

type StatusFilter = "all" | "shared" | "draft" | "expired";

const SHARED_STATUSES = new Set(["shared", "public", "team"]);

function matchesStatus(report: Report, filter: StatusFilter): boolean {
  if (filter === "all") return true;
  if (filter === "shared") return SHARED_STATUSES.has(report.status);
  if (filter === "draft") return report.status === "draft";
  if (filter === "expired") return report.status === "expired";
  return true;
}

const STATUS_NEXT: Record<StatusFilter, StatusFilter> = {
  all: "shared",
  shared: "draft",
  draft: "expired",
  expired: "all",
};

/**
 * Client shell for /app/reports. Owns the search query and the cycling
 * status filter (filters cycle through their values on click — keeps
 * the surface lightweight until we add real dropdown menus).
 */
export function ReportsClient() {
  const [query, setQuery] = useState("");
  const [status, setStatus] = useState<StatusFilter>("all");

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    return REPORTS.filter((report) => {
      if (!matchesStatus(report, status)) return false;
      if (!q) return true;
      return (
        report.title.toLowerCase().includes(q) ||
        report.source.toLowerCase().includes(q)
      );
    });
  }, [query, status]);

  const sharedCount = REPORTS.filter((r) => SHARED_STATUSES.has(r.status)).length;

  return (
    <div className="reports-page panel-reveal">
      <PageHeader
        title="Reports"
        subtitle="Turn scans into shareable findings. Generate PDFs for clients, public links for stakeholders, or detailed exports for your team."
        actions={
          <>
            <Button variant="secondary">
              <Icon name="globe" size={13} />
              Public reports
            </Button>
            <Button variant="primary">
              <Icon name="plus" size={13} />
              New report
            </Button>
          </>
        }
      />

      <TemplateGrid />

      <div className="reports-filterbar">
        <SearchInput
          placeholder="Search reports by title, source, or recipient…"
          value={query}
          onChange={(e) => setQuery(e.currentTarget.value)}
        />
        <FilterChip label="Format" />
        <FilterChip
          label="Status"
          value={status}
          active={status !== "all"}
          onClick={() => setStatus(STATUS_NEXT[status])}
        />
        <FilterChip label="Source" />
        <FilterChip label="Date" />
      </div>

      <ReportsTable
        reports={filtered}
        totalCount={REPORTS.length}
        sharedCount={sharedCount}
      />

      <ReportsQuota />
    </div>
  );
}

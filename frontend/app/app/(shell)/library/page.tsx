"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { PageHeader } from "@/components/ui/PageHeader";
import { Button } from "@/components/ui/Button";
import { Icon } from "@/components/Icon";
import { OriginTabs, type OriginTabRender } from "@/components/app/library/OriginTabs";
import {
  UploadSubTabs,
  type UploadSubTabRender,
} from "@/components/app/library/UploadSubTabs";
import { FilterBar, type LibraryFilters } from "@/components/app/library/FilterBar";
import { SelectionBar } from "@/components/app/library/SelectionBar";
import { LibraryTable } from "@/components/app/library/LibraryTable";
import { AddToCollectionModal } from "@/components/app/library/AddToCollectionModal";
import { NewScanModal } from "@/components/app/home/NewScanModal";
import {
  ORIGIN_TABS,
  UPLOAD_SUBTABS,
  scanToLibraryItem,
  type LibraryItem,
  type OriginTabKey,
  type UploadSubTabKey,
} from "@/lib/library-data";
import { listScans, deleteScan, ScanApiError } from "@/lib/scans-api";
import { getScanCollections } from "@/lib/collection-items";
import { detectorDisplayName } from "@/lib/detector-display";
import type { ScanOrigin, ScanType } from "@/lib/scan-types";
import type { Origin } from "@/components/ui/OriginBadge";

/** Resolve the detector label a row would render — used so the
 *  Detector filter chip matches the exact strings shown in the table. */
const detectorLabel = (r: LibraryItem): string =>
  detectorDisplayName(r.engineId ?? "", r.model);

/** Convert the Date filter chip key into a cutoff timestamp. Returns
 *  null for "today" handling done elsewhere — see callsite. */
function dateCutoffMs(key: string): number | null {
  const now = Date.now();
  if (key === "today") {
    const d = new Date();
    d.setHours(0, 0, 0, 0);
    return d.getTime();
  }
  if (key === "7d") return now - 7 * 24 * 60 * 60 * 1000;
  if (key === "30d") return now - 30 * 24 * 60 * 60 * 1000;
  return null;
}

const PER_PAGE = 25;

const ORIGIN_FOR_TAB: Record<Exclude<OriginTabKey, "all">, ScanOrigin> = {
  up: "upload",
  ext: "ext",
  url: "link",
  paste: "paste",
  mon: "mon",
};

/** "image, video" → "img" if exactly one type is selected. The API
 *  accepts a single type filter; multi-select is a follow-up. */
function singleTypeFilter(s?: string): ScanType | undefined {
  if (!s) return undefined;
  const tokens = s.split(/[,\s]+/).filter(Boolean);
  if (tokens.length !== 1) return undefined;
  const t = tokens[0].toLowerCase();
  if (t === "text" || t === "txt") return "txt";
  if (t === "image" || t === "img") return "img";
  if (t === "audio" || t === "aud") return "aud";
  if (t === "video" || t === "vid") return "vid";
  if (t === "web") return "web";
  if (t === "social" || t === "soc") return "soc";
  return undefined;
}

const UPLOAD_SUBTAB_TYPE: Record<Exclude<UploadSubTabKey, "all">, ScanType> = {
  img: "img",
  vid: "vid",
  aud: "aud",
};

/** Coarse media bucket for the upload sub-tab counts — matches the
 *  ScanType values the sub-tabs filter on. */
function uploadBucket(type: LibraryItem["type"]): UploadSubTabKey | null {
  if (type === "img") return "img";
  if (type === "vid") return "vid";
  if (type === "aud") return "aud";
  return null;
}

/** Static seed list so the Collection dropdown isn't empty on first
 *  load. The page also adds any collection title that appears on a
 *  visible row, so user-created collections show up automatically. */
const DEMO_COLLECTION_OPTIONS = [
  "Fall semester essays",
  "Brand monitoring",
  "Influencer reels review",
  "Press inbox",
];

/** PocketBase record ids are 15 alphanumeric chars. Used as a
 *  defensive guard so bulk mutations never send a non-PB id (e.g. a
 *  client-only placeholder) to an endpoint that would reject it. */
const isPersistedScanId = (id: string) => /^[a-z0-9]{15}$/i.test(id);

export default function LibraryPage() {
  const router = useRouter();
  const [activeTab, setActiveTab] = useState<OriginTabKey>("all");
  const [uploadSubTab, setUploadSubTab] = useState<UploadSubTabKey>("all");
  const [query, setQuery] = useState("");
  const [filters, setFilters] = useState<LibraryFilters>({});
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [page, setPage] = useState(1);
  const [addOpen, setAddOpen] = useState(false);
  const [newScanOpen, setNewScanOpen] = useState(false);

  const [rows, setRows] = useState<LibraryItem[]>([]);
  const [totalItems, setTotalItems] = useState(0);
  const [pageCount, setPageCount] = useState(1);
  const [loadError, setLoadError] = useState<string | null>(null);

  const apiOrigin = activeTab === "all" ? undefined : ORIGIN_FOR_TAB[activeTab];
  // When the user is in an upload sub-tab, that drives the API type
  // filter and overrides whatever the Type chip says — the chip is the
  // catch-all single-tab view.
  const apiType =
    activeTab === "up" && uploadSubTab !== "all"
      ? UPLOAD_SUBTAB_TYPE[uploadSubTab]
      : singleTypeFilter(filters.type);

  useEffect(() => {
    let cancelled = false;
    setLoadError(null);
    (async () => {
      try {
        const result = await listScans({
          page,
          perPage: PER_PAGE,
          origin: apiOrigin,
          type: apiType,
          q: query.trim() || undefined,
        });
        if (cancelled) return;
        const collections = await getScanCollections(
          result.items.map((s) => s.id),
        );
        if (cancelled) return;
        setRows(
          result.items.map((scan) => {
            const ref = collections.get(scan.id);
            return scanToLibraryItem(scan, {
              collection: ref
                ? {
                    title: ref.title,
                    href: `/app/collections/${ref.slug || ref.id}`,
                  }
                : undefined,
            });
          }),
        );
        setTotalItems(result.totalItems);
        setPageCount(Math.max(1, result.totalPages));
      } catch (err) {
        if (cancelled) return;
        if (err instanceof ScanApiError && err.status === 401) {
          setLoadError("Please sign in to view your library.");
        } else {
          setLoadError("Couldn't load your library.");
        }
        setRows([]);
        setTotalItems(0);
        setPageCount(1);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [page, apiOrigin, apiType, query]);

  const allRows = rows;

  // Honest origin-tab counts: the same data the user sees, bucketed by
  // origin. Replaces the previous hardcoded counts that lied about
  // numbers the UI couldn't back up.
  const tabs = useMemo<OriginTabRender[]>(() => {
    const c = (origin: Origin) =>
      allRows.filter((r) => r.origin === origin).length;
    return ORIGIN_TABS.map((spec) => ({
      key: spec.key,
      label: spec.label,
      locked: spec.locked,
      count:
        spec.key === "all"
          ? allRows.length
          : c(spec.key as Origin),
    }));
  }, [allRows]);

  const uploadSubTabs = useMemo<UploadSubTabRender[]>(() => {
    const uploads = allRows.filter((r) => r.origin === "up");
    return UPLOAD_SUBTABS.map((spec) => ({
      key: spec.key,
      label: spec.label,
      count:
        spec.key === "all"
          ? uploads.length
          : uploads.filter((r) => uploadBucket(r.type) === spec.key).length,
    }));
  }, [allRows]);

  const collectionOptions = useMemo<string[]>(() => {
    const seen = new Set<string>(DEMO_COLLECTION_OPTIONS);
    for (const r of allRows) {
      const t = r.meta.collection?.title;
      if (t) seen.add(t);
    }
    return [...seen].sort((a, b) => a.localeCompare(b));
  }, [allRows]);

  /** Detector chip options — derived from the rows actually loaded
   *  on the page so the dropdown can't surface labels that don't
   *  appear in the table. The "—" placeholder used by rows without
   *  an engine is filtered out so it isn't a pick-able value. */
  const detectorOptions = useMemo<string[]>(() => {
    const seen = new Set<string>();
    for (const r of allRows) {
      const label = detectorLabel(r);
      if (label && label !== "—") seen.add(label);
    }
    return [...seen].sort((a, b) => a.localeCompare(b));
  }, [allRows]);

  // Apply origin / sub-tab / client-side filters and per-tab name
  // rewrite. The API already filters by origin/type/q at the row level,
  // but confidence/collection chips and the URL/paste rename are
  // client-only so they always run here.
  const visibleRows = useMemo<LibraryItem[]>(() => {
    let out = allRows;

    if (activeTab !== "all") {
      out = out.filter((r) => r.origin === activeTab);
    }

    if (activeTab === "up" && uploadSubTab !== "all") {
      out = out.filter((r) => uploadBucket(r.type) === uploadSubTab);
    }

    const typeKey = filters.type;
    if (typeKey) {
      out = out.filter((r) => {
        // "Social" should match the umbrella `soc` plus the platform
        // sub-types we generate from the extension (fb-*, ig-*, yt-*).
        if (typeKey === "soc") {
          return r.type === "soc" || r.type.includes("-");
        }
        return r.type === typeKey;
      });
    }

    const verdict = filters.verdict;
    if (verdict) {
      // Mirror the table's tone thresholds (verdict-tone.ts) so a row
      // wearing a red Pill answers the AI filter, etc. Demo rows that
      // have no `aiPct` fall back to `confidence` — same fallback the
      // Pill itself uses.
      out = out.filter((r) => {
        const score = r.aiPct ?? r.confidence;
        if (verdict === "ai") return score >= 70;
        if (verdict === "mixed") return score >= 40 && score < 70;
        return score < 40;
      });
    }

    if (filters.detector) {
      const want = filters.detector;
      out = out.filter((r) => detectorLabel(r) === want);
    }

    if (filters.date) {
      const cutoff = dateCutoffMs(filters.date);
      if (cutoff !== null) {
        out = out.filter((r) => {
          if (!r.whenIso) return false;
          const ts = Date.parse(r.whenIso);
          return Number.isFinite(ts) && ts >= cutoff;
        });
      }
    }

    if (filters.collection) {
      out = out.filter(
        (r) => r.meta.collection?.title === filters.collection,
      );
    }

    if (query.trim()) {
      const needle = query.trim().toLowerCase();
      out = out.filter(
        (r) =>
          r.name.toLowerCase().includes(needle) ||
          (r.meta.domain ?? "").toLowerCase().includes(needle) ||
          (r.meta.textPreview ?? "").toLowerCase().includes(needle) ||
          (r.link?.url ?? "").toLowerCase().includes(needle),
      );
    }

    if (activeTab === "url") {
      out = out.map((r) => {
        const fromMeta = [r.meta.domain, r.meta.pathTail]
          .filter(Boolean)
          .join("/");
        const url = r.link?.url || fromMeta || r.name;
        return { ...r, name: url };
      });
    } else if (activeTab === "paste") {
      out = out.map((r) => ({
        ...r,
        name: r.meta.textPreview ?? r.name,
      }));
    }

    return out;
  }, [allRows, activeTab, uploadSubTab, filters, query]);

  const visibleTotal = visibleRows.length;

  const toggleRow = (id: string, next: boolean) => {
    setSelectedIds((prev) => {
      const out = new Set(prev);
      if (next) out.add(id);
      else out.delete(id);
      return out;
    });
  };

  const toggleAll = (next: boolean) => {
    setSelectedIds(next ? new Set(visibleRows.map((r) => r.id)) : new Set());
  };

  const openRow = (id: string) => router.push(`/editor/${id}`);

  /** Refetch the current page + collection chips. Shared by bulk
   *  delete and bulk add-to-collection so both surfaces show the
   *  updated rows immediately. */
  const reloadRows = async () => {
    const result = await listScans({
      page,
      perPage: PER_PAGE,
      origin: apiOrigin,
      type: apiType,
      q: query.trim() || undefined,
    }).catch(() => null);
    if (!result) return;
    const collections = await getScanCollections(
      result.items.map((s) => s.id),
    );
    setRows(
      result.items.map((scan) => {
        const ref = collections.get(scan.id);
        return scanToLibraryItem(scan, {
          collection: ref
            ? {
                title: ref.title,
                href: `/app/collections/${ref.slug || ref.id}`,
              }
            : undefined,
        });
      }),
    );
    setTotalItems(result.totalItems);
    setPageCount(Math.max(1, result.totalPages));
  };

  const handleBulkDelete = async () => {
    // Demo seed rows have non-PB ids that would 404; skip them so the
    // request batch only hits real scans the user can actually delete.
    const ids = [...selectedIds].filter(isPersistedScanId);
    if (ids.length === 0) {
      setSelectedIds(new Set());
      return;
    }
    await Promise.all(ids.map((id) => deleteScan(id).catch(() => null)));
    setSelectedIds(new Set());
    await reloadRows();
  };

  return (
    <div className="lib panel-reveal">
      <PageHeader
        title="Library"
        subtitle="Every scan, every source, one place. Filter by how it arrived, what it is, or what we found."
        actions={
          <Button variant="primary" onClick={() => setNewScanOpen(true)}>
            <Icon name="plus" size={13} />
            New scan
          </Button>
        }
      />

      <OriginTabs
        tabs={tabs}
        value={activeTab}
        onChange={(next) => {
          setActiveTab(next);
          if (next !== "up") setUploadSubTab("all");
          setPage(1);
        }}
      />

      {activeTab === "up" && (
        <UploadSubTabs
          tabs={uploadSubTabs}
          value={uploadSubTab}
          onChange={(next) => {
            setUploadSubTab(next);
            setPage(1);
          }}
        />
      )}

      <FilterBar
        query={query}
        onQueryChange={(v) => {
          setQuery(v);
          setPage(1);
        }}
        filters={filters}
        onFiltersChange={(next) => {
          setFilters(next);
          setPage(1);
        }}
        collectionOptions={collectionOptions}
        detectorOptions={detectorOptions}
      />

      {selectedIds.size > 0 && (
        <SelectionBar
          count={selectedIds.size}
          onClear={() => setSelectedIds(new Set())}
          onAction={(key) => {
            if (key === "delete") void handleBulkDelete();
            else if (key === "collect") setAddOpen(true);
          }}
        />
      )}

      {addOpen && (
        <AddToCollectionModal
          scanIds={[...selectedIds].filter(isPersistedScanId)}
          onClose={() => setAddOpen(false)}
          onAdded={() => {
            setSelectedIds(new Set());
            void reloadRows();
          }}
        />
      )}

      {newScanOpen && (
        <NewScanModal
          onClose={() => setNewScanOpen(false)}
          onCreated={(scanId) => {
            setNewScanOpen(false);
            router.push(`/editor/${scanId}`);
          }}
        />
      )}

      {loadError ? (
        <div className="lib-empty" role="status">{loadError}</div>
      ) : visibleRows.length === 0 ? (
        <div className="lib-empty" role="status">
          No scans match these filters yet.
        </div>
      ) : (
        <LibraryTable
          rows={visibleRows}
          total={Math.max(visibleTotal, totalItems)}
          selectedIds={selectedIds}
          onToggleRow={toggleRow}
          onToggleAll={toggleAll}
          onOpenRow={openRow}
          page={page}
          pageCount={pageCount}
          onPageChange={setPage}
        />
      )}
    </div>
  );
}

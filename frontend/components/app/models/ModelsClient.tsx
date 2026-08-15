"use client";

import { useEffect, useMemo, useState } from "react";
import { canUseModel, type Plan } from "@heynotai/shared";
import { PageHeader } from "@/components/ui/PageHeader";
import { Button } from "@/components/ui/Button";
import { Icon } from "@/components/Icon";
import { useAuth } from "@/lib/auth";
import {
  TYPE_TABS,
  type Engine,
  type EngineType,
  type TokenUsage,
} from "@/lib/models-data";
import { fetchModelsCatalog, fetchMonthlyUsage } from "@/lib/models-api";
import { TokenUsageBand } from "./TokenUsageBand";
import { TypeSwitcher } from "./TypeSwitcher";
import { EngineSection } from "./EngineSection";
import { SuggestEngine } from "./SuggestEngine";
import { ModelsSkeleton } from "./ModelsSkeleton";

/**
 * Client shell for /app/models. Owns:
 *   - which content type is currently focused (drives the section render)
 *   - which engine is selected per type (one selection per type, persists
 *     across tab switches so a user can configure all four without losing
 *     state)
 *   - the live model catalog from `/models` and per-user token usage from
 *     `/me/usage`.
 *
 * There is no seeded engine list behind this any more. When `/models`
 * can't be reached the page says so — it used to fall back to a
 * hard-coded catalog, so an API outage showed engines that don't exist
 * and let the user "select" one.
 *
 * The metadata + page wrapper sits in a sibling server file so we can
 * keep the per-route title.
 */
const EMPTY_ENGINES: Record<EngineType, Engine[]> = {
  txt: [], img: [], aud: [], vid: [],
};
const EMPTY_DEFAULTS: Record<EngineType, string> = {
  txt: "", img: "", aud: "", vid: "",
};

export function ModelsClient() {
  const { user } = useAuth();
  const userPlan: Plan = user?.plan ?? "check";
  const [activeType, setActiveType] = useState<EngineType>("txt");
  const [engines, setEngines] =
    useState<Record<EngineType, Engine[]>>(EMPTY_ENGINES);
  const [defaults, setDefaults] =
    useState<Record<EngineType, string>>(EMPTY_DEFAULTS);
  const [selectedByType, setSelectedByType] =
    useState<Record<EngineType, string>>(EMPTY_DEFAULTS);
  const [usage, setUsage] = useState<TokenUsage | null>(null);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState(false);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      const [catalog, monthly] = await Promise.all([
        fetchModelsCatalog(),
        fetchMonthlyUsage(),
      ]);
      if (cancelled) return;
      if (!catalog) {
        setLoadError(true);
      } else {
        setLoadError(false);
        setEngines(catalog.engines);
        setDefaults(catalog.defaults);
        setSelectedByType((prev) => {
          const next = { ...prev };
          (Object.keys(catalog.defaults) as EngineType[]).forEach((t) => {
            const list = catalog.engines[t];
            const liveIds = new Set(list.map((e) => e.id));
            const prevEngine = list.find((e) => e.id === prev[t]);
            const prevReachable =
              !!prevEngine && canUseModel(userPlan, prevEngine.tier);
            // Swap to the plan-aware default when the previous
            // selection is missing from the live catalog OR is now
            // above the user's tier (downgrade case).
            if (
              (!liveIds.has(prev[t]) || !prevReachable) &&
              catalog.defaults[t]
            ) {
              next[t] = catalog.defaults[t];
            }
          });
          return next;
        });
      }
      setUsage(monthly);
      setLoading(false);
    })();
    return () => {
      cancelled = true;
    };
  }, [userPlan]);

  // Cheapest-first within each modality. The API already sorts by
  // tokenCost,accuracy, but we re-sort defensively so the offline
  // fallback (`ENGINES`) is also ordered.
  const sortedEngines = useMemo(() => {
    const out: Record<EngineType, Engine[]> = { txt: [], img: [], aud: [], vid: [] };
    (Object.keys(engines) as EngineType[]).forEach((t) => {
      out[t] = [...engines[t]].sort((a, b) => a.cost.value - b.cost.value);
    });
    return out;
  }, [engines]);

  const captions: Record<EngineType, string> = TYPE_TABS.reduce(
    (acc, tab) => {
      const id = selectedByType[tab.type];
      const engine = sortedEngines[tab.type].find((e) => e.id === id);
      acc[tab.type] = engine?.name ?? "—";
      return acc;
    },
    {} as Record<EngineType, string>,
  );

  const handleSelect = (id: string) => {
    setSelectedByType((prev) => ({ ...prev, [activeType]: id }));
  };

  return (
    <div className="models panel-reveal">
      <PageHeader
        title="Models"
        subtitle="Pick which engine runs for each content type. Every scan consumes tokens — choose fast engines for high-volume work, premium engines for important verifications."
        // "Usage history" used to sit here with no handler and no page
        // behind it. The month-to-date figures live in the band below,
        // so the only header action left is the one that goes somewhere.
        actions={
          <Button variant="primary" href="/app/upgrade">
            <Icon name="plus" size={13} />
            Buy tokens
          </Button>
        }
      />

      <TokenUsageBand usage={usage} />

      <TypeSwitcher
        value={activeType}
        onChange={setActiveType}
        captions={captions}
      />

      {loading ? (
        <ModelsSkeleton rows={sortedEngines[activeType].length || 3} />
      ) : loadError ? (
        <p className="models-empty" role="status">
          Couldn&apos;t load the detector catalog. Check your connection and
          refresh — no engines are listed until we can confirm what&apos;s
          actually available.
        </p>
      ) : sortedEngines[activeType].length === 0 ? (
        <p className="models-empty" role="status">
          No detectors are enabled for this content type yet.
        </p>
      ) : (
        <EngineSection
          type={activeType}
          engines={sortedEngines[activeType]}
          selectedId={selectedByType[activeType] || defaults[activeType]}
          onSelect={handleSelect}
        />
      )}

      <SuggestEngine />
    </div>
  );
}

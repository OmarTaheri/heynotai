"use client";

import { useEffect, useState } from "react";
import { PageHeader } from "@/components/ui/PageHeader";
import { Button } from "@/components/ui/Button";
import { Icon } from "@/components/Icon";
import {
  DEFAULT_SELECTION,
  ENGINES,
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
 *     `/me/usage`. The static `ENGINES`/`DEFAULT_SELECTION` constants are
 *     used as a transient fallback while the fetches are inflight so the
 *     skeleton has shape to render against.
 *
 * The metadata + page wrapper sits in a sibling server file so we can
 * keep the per-route title.
 */
export function ModelsClient() {
  const [activeType, setActiveType] = useState<EngineType>("txt");
  const [engines, setEngines] = useState<Record<EngineType, Engine[]>>(ENGINES);
  const [defaults, setDefaults] =
    useState<Record<EngineType, string>>(DEFAULT_SELECTION);
  const [selectedByType, setSelectedByType] =
    useState<Record<EngineType, string>>(DEFAULT_SELECTION);
  const [usage, setUsage] = useState<TokenUsage | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      const [catalog, monthly] = await Promise.all([
        fetchModelsCatalog(),
        fetchMonthlyUsage(),
      ]);
      if (cancelled) return;
      // Only swap to live engines if the response had any rows — otherwise
      // keep the seeded fallback so the page never goes empty.
      const hasAny = (Object.values(catalog.engines) as Engine[][]).some(
        (list) => list.length > 0,
      );
      if (hasAny) {
        setEngines(catalog.engines);
        setDefaults(catalog.defaults);
        setSelectedByType((prev) => {
          const next = { ...prev };
          (Object.keys(catalog.defaults) as EngineType[]).forEach((t) => {
            const list = catalog.engines[t];
            const liveIds = new Set(list.map((e) => e.id));
            // Swap to default when the previous selection isn't in the
            // live catalog (e.g. a model was disabled in PB).
            if (!liveIds.has(prev[t]) && catalog.defaults[t]) {
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
  }, []);

  const captions: Record<EngineType, string> = TYPE_TABS.reduce(
    (acc, tab) => {
      const id = selectedByType[tab.type];
      const engine = engines[tab.type].find((e) => e.id === id);
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
        actions={
          <>
            <Button variant="secondary">
              <Icon name="activity" size={13} />
              Usage history
            </Button>
            <Button variant="primary">
              <Icon name="plus" size={13} />
              Buy tokens
            </Button>
          </>
        }
      />

      <TokenUsageBand usage={usage} />

      <TypeSwitcher
        value={activeType}
        onChange={setActiveType}
        captions={captions}
      />

      {loading ? (
        <ModelsSkeleton rows={engines[activeType].length || 3} />
      ) : (
        <EngineSection
          type={activeType}
          engines={engines[activeType]}
          selectedId={selectedByType[activeType] || defaults[activeType]}
          onSelect={handleSelect}
        />
      )}

      <SuggestEngine />
    </div>
  );
}

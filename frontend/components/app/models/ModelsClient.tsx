"use client";

import { useState } from "react";
import { PageHeader } from "@/components/ui/PageHeader";
import { Button } from "@/components/ui/Button";
import { Icon } from "@/components/Icon";
import {
  DEFAULT_SELECTION,
  ENGINES,
  TYPE_TABS,
  type EngineType,
} from "@/lib/models-data";
import { TokenUsageBand } from "./TokenUsageBand";
import { TypeSwitcher } from "./TypeSwitcher";
import { EngineSection } from "./EngineSection";
import { SuggestEngine } from "./SuggestEngine";

/**
 * Client shell for /app/models. Owns:
 *   - which content type is currently focused (drives the section render)
 *   - which engine is selected per type (one selection per type, persists
 *     across tab switches so a user can configure all four without losing
 *     state)
 *
 * The metadata + page wrapper sits in a sibling server file so we can
 * keep the per-route title.
 */
export function ModelsClient() {
  const [activeType, setActiveType] = useState<EngineType>("txt");
  const [selectedByType, setSelectedByType] =
    useState<Record<EngineType, string>>(DEFAULT_SELECTION);

  const captions: Record<EngineType, string> = TYPE_TABS.reduce(
    (acc, tab) => {
      const id = selectedByType[tab.type];
      const engine = ENGINES[tab.type].find((e) => e.id === id);
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

      <TokenUsageBand />

      <TypeSwitcher
        value={activeType}
        onChange={setActiveType}
        captions={captions}
      />

      <EngineSection
        type={activeType}
        selectedId={selectedByType[activeType]}
        onSelect={handleSelect}
      />

      <SuggestEngine />
    </div>
  );
}

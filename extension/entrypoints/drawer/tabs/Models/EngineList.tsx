import { Icon } from '@/components/Icon';
import { MetricCard } from '@/components/MetricCard';
import { isModelLocked, type Plan } from '@heynotai/shared';
import type { EngineType, ModelsCatalog } from '@/lib/models-api';
import { EngineRow } from './EngineRow';
import { TYPE_ICON, TYPE_LABEL } from './constants';

export function EngineList({
  type,
  catalog,
  selectedId,
  autoModelMode,
  userPlan,
  onSelect,
  onRetry,
}: {
  type: EngineType;
  catalog: ModelsCatalog | null;
  selectedId: string;
  autoModelMode: boolean;
  userPlan: Plan;
  onSelect: (id: string) => void;
  onRetry: () => void;
}) {
  return (
    <MetricCard
      title={TYPE_LABEL[type]}
      action={
        <span className="card-action" style={{ display: 'inline-flex', alignItems: 'center', gap: 5 }}>
          <Icon name={TYPE_ICON[type]} size={12} /> {type}
        </span>
      }
    >
      <div style={{ display: 'flex', flexDirection: 'column', gap: 6, marginTop: 2 }}>
        {!catalog ? (
          <SkeletonRows />
        ) : catalog.engines[type].length === 0 ? (
          <EmptyRow onRetry={onRetry} />
        ) : (
          catalog.engines[type].map((eng) => {
            const locked = isModelLocked(userPlan, eng.tier);
            return (
              <EngineRow
                key={eng.id}
                engine={eng}
                active={!locked && selectedId === eng.id}
                autoPicked={autoModelMode && catalog.defaults[type] === eng.id}
                disabled={autoModelMode}
                locked={locked}
                onSelect={() => onSelect(eng.id)}
              />
            );
          })
        )}
      </div>
    </MetricCard>
  );
}

function SkeletonRows() {
  return (
    <div className="model-skeleton">
      <div className="model-skeleton-row" />
      <div className="model-skeleton-row" />
    </div>
  );
}

function EmptyRow({ onRetry }: { onRetry: () => void }) {
  return (
    <div className="model-empty">
      <div>No models available right now.</div>
      <button type="button" className="btn-link" onClick={onRetry}>Retry</button>
    </div>
  );
}

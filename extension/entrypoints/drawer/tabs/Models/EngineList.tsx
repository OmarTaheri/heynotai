import { Icon } from '@/components/Icon';
import { MetricCard } from '@/components/MetricCard';
import { isModelLocked, type Plan } from '@heynotai/shared';
import type { EngineType, ModelsCatalog } from '@/lib/models-api';
import { EngineRow } from './EngineRow';
import { TYPE_ICON, TYPE_LABEL, TYPE_NOUN } from './constants';

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
  const list = catalog?.engines[type] ?? [];
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
        ) : catalog.error ? (
          <ErrorRow error={catalog.error} onRetry={onRetry} />
        ) : list.length === 0 ? (
          <EmptyRow type={type} />
        ) : (
          list.map((eng) => {
            const locked = isModelLocked(userPlan, eng.tier);
            const autoPicked = autoModelMode && catalog.defaults[type] === eng.id;
            return (
              <EngineRow
                key={eng.id}
                engine={eng}
                active={!locked && selectedId === eng.id}
                autoPicked={autoPicked}
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

/** Load failure — always retryable, and says *why* so a signed-out
 *  user isn't told the catalog is empty. */
function ErrorRow({ error, onRetry }: { error: string; onRetry: () => void }) {
  const message =
    error === 'signed_out'
      ? 'Sign in to see the checkers available on your plan.'
      : "Couldn't reach heynotai to load the checker list.";
  return (
    <div className="model-empty">
      <div>{message}</div>
      <button type="button" className="btn-link" onClick={onRetry}>Retry</button>
    </div>
  );
}

/** The catalog loaded fine, this modality just has nothing enabled
 *  server-side yet (audio, today). Not an error — no retry button,
 *  because retrying will never change the answer. */
function EmptyRow({ type }: { type: EngineType }) {
  return (
    <div className="model-empty">
      <div>No {TYPE_NOUN[type]} checkers yet.</div>
      <div className="model-empty-sub">We'll add them here as they go live.</div>
    </div>
  );
}

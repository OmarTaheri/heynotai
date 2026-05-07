import { Chip } from '@/components/Chip';
import { Dropdown } from '@/components/Dropdown';
import { type Range, type Scope, RANGE_LABELS } from '@/lib/stats-data';
import { RANGES, SCOPE_OPTIONS } from './helpers';

export function StatsFilters({
  scope,
  setScope,
  range,
  setRange,
}: {
  scope: Scope;
  setScope: (s: Scope) => void;
  range: Range;
  setRange: (r: Range) => void;
}) {
  return (
    <div className="stats-filters">
      <Dropdown
        value={scope}
        options={SCOPE_OPTIONS}
        onChange={setScope}
        ariaLabel="Change scope"
        buttonLabel={(o) => (
          <>
            {o.icon}
            <span>{o.label}</span>
          </>
        )}
      />
      <div className="chips" style={{ margin: 0 }}>
        {RANGES.map(r => (
          <Chip key={r} active={range === r} onClick={() => setRange(r)}>
            {RANGE_LABELS[r]}
          </Chip>
        ))}
      </div>
    </div>
  );
}

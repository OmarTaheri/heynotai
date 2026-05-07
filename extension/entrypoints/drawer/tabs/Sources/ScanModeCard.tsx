import { Icon } from '@/components/Icon';
import { MetricCard } from '@/components/MetricCard';
import type { ScanMode } from '@/lib/state';
import { MODES } from './constants';

export function ScanModeCard({
  scanMode,
  setScanMode,
}: {
  scanMode: ScanMode;
  setScanMode: (m: ScanMode) => void;
}) {
  const everything = scanMode === 'everything';
  return (
    <MetricCard title="Scan mode">
      <div>
        {MODES.map(m => {
          const danger = m.key === 'everything';
          const active = scanMode === m.key;
          return (
            <button
              key={m.key}
              type="button"
              className={`radio-row${active ? ' active' : ''}${danger ? ' danger' : ''}`}
              onClick={() => setScanMode(m.key)}
            >
              <span className="radio-bullet" />
              <div className="radio-body">
                <div className="radio-label">
                  {m.label}
                  {danger && <span className="danger-pill">high usage</span>}
                </div>
                <div className="radio-hint">{m.hint}</div>
              </div>
            </button>
          );
        })}
      </div>
      {everything && (
        <div className="warning-banner">
          <Icon name="info" size={14} />
          <span>Consumes tokens very fast — scanning every site you visit indiscriminately.</span>
        </div>
      )}
    </MetricCard>
  );
}

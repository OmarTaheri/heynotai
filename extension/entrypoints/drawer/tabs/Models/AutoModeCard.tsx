import { Icon } from '@/components/Icon';
import { Toggle } from '@/components/Toggle';

export function AutoModeCard({
  autoModelMode,
  setAutoModelMode,
}: {
  autoModelMode: boolean;
  setAutoModelMode: (v: boolean) => void;
}) {
  return (
    <section className={`card auto-card${autoModelMode ? ' active' : ''}`}>
      <div className="auto-row">
        <div className="auto-icon"><Icon name="sparkle" size={16} /></div>
        <div className="auto-copy">
          <div className="auto-title">Auto mode</div>
          <div className="auto-desc">
            {autoModelMode
              ? "heynotai is picking the best checker for each task."
              : 'Let heynotai choose the best checker per task automatically.'}
          </div>
        </div>
        <Toggle
          on={autoModelMode}
          onChange={() => setAutoModelMode(!autoModelMode)}
          label="Auto mode"
        />
      </div>
    </section>
  );
}

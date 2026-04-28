import { useState } from 'react';
import { Icon } from '@/components/Icon';
import { MetricCard } from '@/components/MetricCard';
import { Row } from '@/components/Row';
import { Toggle } from '@/components/Toggle';
import { MODEL_GROUPS } from '@/lib/sample-data';
import { useApp } from '@/lib/state';
import type { ContentKind, ModelOption } from '@/lib/types';

type PrefKey = 'cloud' | 'cache' | 'share';

// Which option id the Auto picker would choose per content type (dummy logic for now).
const AUTO_PICKS: Record<ContentKind, string> = {
  text:  'heynotai-text-v3',
  image: 'pixel-forensics',
  audio: 'wave-scan',
  video: 'frame-drift',
};

function ModelOpt({
  opt, active, onSelect, powerMode, disabled, autoPicked,
}: {
  opt: ModelOption;
  active: boolean;
  onSelect: () => void;
  powerMode: boolean;
  disabled: boolean;
  autoPicked: boolean;
}) {
  const name = powerMode ? opt.name : opt.friendlyName;
  const spec = powerMode ? opt.spec : opt.friendlySpec;
  return (
    <button
      type="button"
      className={`model-opt${active ? ' active' : ''}${disabled ? ' disabled' : ''}`}
      onClick={disabled ? undefined : onSelect}
      disabled={disabled}
      aria-disabled={disabled}
    >
      <span className="bullet" />
      <div className="mo-body">
        <div className="mo-head">
          <span className="mo-name">{name}</span>
          {autoPicked && <span className="mo-tag mo-tag-auto">auto-pick</span>}
          {powerMode && !autoPicked && <span className="mo-tag">{opt.tag}</span>}
        </div>
        <div className="mo-spec">{spec}</div>
      </div>
      <span className={`mo-speed ${opt.speed}`}>{opt.speed}</span>
    </button>
  );
}

export function Models() {
  const { mode, autoModelMode, setAutoModelMode } = useApp();
  const powerMode = mode === 'power';

  const [selected, setSelected] = useState<Record<ContentKind, string>>({
    text: 'heynotai-text-v3',
    image: 'pixel-forensics',
    audio: 'wave-scan',
    video: 'frame-drift',
  });
  const [prefs, setPrefs] = useState<Record<PrefKey, boolean>>({
    cloud: true, cache: true, share: false,
  });

  const bannerTitle = powerMode
    ? 'Choose one model per content type'
    : 'Pick a checker for each type of content';
  const bannerDesc = powerMode
    ? 'Larger models are more accurate but slower. You can change these anytime; running scans will finish on the current model.'
    : "We'll use these to check for AI. You can change them anytime — switch to Power mode in Settings to see the technical model names.";

  // What's effectively active for each kind — auto picks override manual selection while on.
  const effective: Record<ContentKind, string> = autoModelMode
    ? AUTO_PICKS
    : selected;

  return (
    <div className={`panel${autoModelMode ? ' auto-active' : ''}`}>
      {/* Auto mode activation */}
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

      <div className="info-banner">
        <Icon name="sparkle" size={15} />
        <div>
          <div className="b-title">{bannerTitle}</div>
          <div className="b-desc">{bannerDesc}</div>
        </div>
      </div>

      {MODEL_GROUPS.map(g => (
        <MetricCard
          key={g.key}
          title={g.label}
          action={
            <span className="card-action" style={{ display: 'inline-flex', alignItems: 'center', gap: 5 }}>
              <Icon name={g.icon} size={12} /> {g.key}
            </span>
          }
        >
          <div style={{ display: 'flex', flexDirection: 'column', gap: 6, marginTop: 2 }}>
            {g.options.map(o => {
              const isActive = effective[g.key] === o.id;
              const autoPicked = autoModelMode && AUTO_PICKS[g.key] === o.id;
              return (
                <ModelOpt
                  key={o.id}
                  opt={o}
                  active={isActive}
                  autoPicked={autoPicked}
                  disabled={autoModelMode}
                  powerMode={powerMode}
                  onSelect={() => setSelected(s => ({ ...s, [g.key]: o.id }))}
                />
              );
            })}
          </div>
        </MetricCard>
      ))}

      {powerMode && (
        <MetricCard title="Advanced">
          <div>
            <Row label="Cloud scanning" value={
              <Toggle on={prefs.cloud} onChange={() => setPrefs(p => ({ ...p, cloud: !p.cloud }))} label="Cloud scanning" />
            } />
            <Row label="Cache results" value={
              <Toggle on={prefs.cache} onChange={() => setPrefs(p => ({ ...p, cache: !p.cache }))} label="Cache results" />
            } />
            <Row label="Share anonymised signals" value={
              <Toggle on={prefs.share} onChange={() => setPrefs(p => ({ ...p, share: !p.share }))} label="Share anonymised signals" />
            } />
          </div>
        </MetricCard>
      )}
    </div>
  );
}

import { useEffect, useState } from 'react';
import { isModelLocked, type Plan } from '@heynotai/shared';
import { Icon } from '@/components/Icon';
import { MetricCard } from '@/components/MetricCard';
import { Row } from '@/components/Row';
import { Toggle } from '@/components/Toggle';
import { useApp } from '@/lib/state';
import { useAuth } from '@/lib/auth-state';
import { FRONTEND_URL } from '@/lib/scans-api';
import {
  fetchModelsCatalog,
  type Engine,
  type EngineType,
  type ModelsCatalog,
} from '@/lib/models-api';

type PrefKey = 'cloud' | 'cache' | 'share';

const TYPES: EngineType[] = ['txt', 'img', 'aud', 'vid'];

const TYPE_LABEL: Record<EngineType, string> = {
  txt: 'Text detection',
  img: 'Image detection',
  aud: 'Audio detection',
  vid: 'Video detection',
};

const TYPE_ICON: Record<EngineType, 'text' | 'image' | 'audio' | 'video'> = {
  txt: 'text',
  img: 'image',
  aud: 'audio',
  vid: 'video',
};

const TIER_LABEL: Record<Plan, string> = {
  check: 'FREE',
  verify: 'VERIFY',
  certify: 'CERTIFY',
  team: 'TEAM',
};

/* Mailto for the team-tier "Contact sales" CTA. Mirrors
 * `TEAM_SALES_MAILTO` in `frontend/lib/plans-data.ts`. */
const TEAM_SALES_MAILTO = 'mailto:sales@heynotai.io?subject=Team%20plan';

function openUpgrade(tier: Plan) {
  const url = tier === 'team' ? TEAM_SALES_MAILTO : `${FRONTEND_URL}/app/upgrade`;
  if (chrome?.tabs?.create) chrome.tabs.create({ url });
  else window.open(url, '_blank');
}

function EngineRow({
  engine, active, autoPicked, disabled, locked, onSelect,
}: {
  engine: Engine;
  active: boolean;
  autoPicked: boolean;
  disabled: boolean;
  locked: boolean;
  onSelect: () => void;
}) {
  const tierClass = engine.tier === 'check' ? '' : ` tier-${engine.tier}`;
  const upgradeCta = engine.tier === 'team' ? 'Contact sales' : 'Upgrade';
  const handleClick = () => {
    if (locked) {
      openUpgrade(engine.tier);
      return;
    }
    if (!disabled) onSelect();
  };
  return (
    <button
      type="button"
      className={`model-opt${active ? ' active' : ''}${disabled ? ' disabled' : ''}${locked ? ' locked' : ''}${tierClass}`}
      onClick={handleClick}
      disabled={disabled && !locked}
      aria-disabled={disabled || locked}
    >
      <span className="bullet" aria-hidden>
        {locked && <Icon name="lock" size={9} />}
      </span>
      <div className="mo-body">
        <div className="mo-head">
          <span className="mo-name">{engine.name}</span>
          {engine.tier !== 'check' && (
            <span className={`mo-tag mo-tag-tier tier-${engine.tier}`}>
              {TIER_LABEL[engine.tier]}
            </span>
          )}
          {engine.isDefault && <span className="mo-tag mo-tag-default">DEFAULT</span>}
          {autoPicked && <span className="mo-tag mo-tag-auto">auto-pick</span>}
        </div>
        {engine.description && <div className="mo-spec">{engine.description}</div>}
        <div className="mo-meta">
          <span>{engine.accuracy}% accuracy</span>
          <span aria-hidden>·</span>
          <span className={`mo-cost mo-cost-${engine.cost.tone}`}>
            {engine.cost.value} {engine.cost.unit}
          </span>
        </div>
        {locked && (
          <span className={`mo-upgrade${tierClass}`} role="presentation">
            <Icon name={upgradeCta === 'Contact sales' ? 'users' : 'sparkle'} size={10} />
            {upgradeCta}
          </span>
        )}
      </div>
    </button>
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

export function Models() {
  const { mode, autoModelMode, setAutoModelMode } = useApp();
  const { user } = useAuth();
  const userPlan: Plan = (user?.plan as Plan | undefined) ?? 'check';
  const powerMode = mode === 'power';

  const [catalog, setCatalog] = useState<ModelsCatalog | null>(null);
  const [loadTick, setLoadTick] = useState(0);
  const [selected, setSelected] = useState<Record<EngineType, string>>({
    txt: '', img: '', aud: '', vid: '',
  });
  const [prefs, setPrefs] = useState<Record<PrefKey, boolean>>({
    cloud: true, cache: true, share: false,
  });

  useEffect(() => {
    let cancelled = false;
    setCatalog(null);
    void fetchModelsCatalog().then((c) => {
      if (cancelled) return;
      setCatalog(c);
      setSelected((prev) => ({
        txt: prev.txt || c.defaults.txt,
        img: prev.img || c.defaults.img,
        aud: prev.aud || c.defaults.aud,
        vid: prev.vid || c.defaults.vid,
      }));
    });
    return () => { cancelled = true; };
  }, [user?.id, loadTick]);

  const bannerTitle = 'Pick a checker for each type of content';
  const bannerDesc = autoModelMode
    ? "heynotai is choosing the recommended checker per type. Turn off Auto mode to pick your own."
    : "We'll use these to check for AI. Switch to Power mode in Settings for the technical names.";

  const effective: Record<EngineType, string> = autoModelMode && catalog
    ? catalog.defaults
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

      {TYPES.map((type) => (
        <MetricCard
          key={type}
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
              <EmptyRow onRetry={() => setLoadTick((n) => n + 1)} />
            ) : (
              catalog.engines[type].map((eng) => {
                const locked = isModelLocked(userPlan, eng.tier);
                return (
                  <EngineRow
                    key={eng.id}
                    engine={eng}
                    active={!locked && effective[type] === eng.id}
                    autoPicked={autoModelMode && catalog.defaults[type] === eng.id}
                    disabled={autoModelMode}
                    locked={locked}
                    onSelect={() => setSelected((s) => ({ ...s, [type]: eng.id }))}
                  />
                );
              })
            )}
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

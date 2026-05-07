import type { Plan } from '@heynotai/shared';
import { Icon } from '@/components/Icon';
import { FRONTEND_URL } from '@/lib/scans-api';
import type { Engine } from '@/lib/models-api';
import { TEAM_SALES_MAILTO, TIER_LABEL } from './constants';

function openUpgrade(tier: Plan) {
  const url = tier === 'team' ? TEAM_SALES_MAILTO : `${FRONTEND_URL}/app/upgrade`;
  if (chrome?.tabs?.create) chrome.tabs.create({ url });
  else window.open(url, '_blank');
}

export function EngineRow({
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

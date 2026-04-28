import { useEffect, useState } from 'react';
import { Icon, type IconName } from '@/components/Icon';
import { useApp } from '@/lib/state';
import { useAuth, type Plan } from '@/lib/auth-state';

const PLAN_LABEL: Record<Plan, string> = {
  check: 'Check',
  verify: 'Verify',
  certify: 'Certify',
  team: 'Team',
};
const PLAN_ICON: Record<Plan, IconName> = {
  check: 'info',
  verify: 'shield',
  certify: 'check',
  team: 'user',
};

export function Header() {
  const {
    scanning, progress, startScan,
    view, toggleAccount, toggleSettings,
  } = useApp();
  const { user } = useAuth();

  const inSettings = view === 'settings';
  const inAccount  = view === 'account';
  const inOverlay  = inSettings || inAccount;

  const plan: Plan = user?.plan ?? 'check';

  const [logoClosed, setLogoClosed] = useState(false);
  useEffect(() => {
    const t = setTimeout(() => setLogoClosed(true), 1000);
    return () => clearTimeout(t);
  }, []);

  return (
    <>
      <header className="pop-header">
        <div className="brand-meta">
          <div className="brand-row">
            <span
              className={`logo-word${logoClosed ? ' is-closed' : ''}`}
              aria-label="heynotai"
            >
              <span className="logo-hey">hey</span>
              <span className="logo-not"><span className="logo-not-inner">not</span></span>
              <span className="logo-ai">
                <span className="logo-strike" aria-hidden />
                ai
              </span>
            </span>
            <span className="version-tag">v3.2</span>
          </div>
        </div>

        <div className="header-actions">
          {/* Plan badge — read-only; opens account view to upgrade */}
          <div className={`action-slot${inOverlay ? ' collapsed' : ''}`}>
            <button
              type="button"
              className={`mode-badge mode-${plan}`}
              onClick={toggleAccount}
              title={`Plan: ${PLAN_LABEL[plan]}`}
              aria-label={`Plan: ${PLAN_LABEL[plan]}. Open account.`}
              tabIndex={inOverlay ? -1 : 0}
            >
              <Icon name={PLAN_ICON[plan]} size={11} />
              <span>{PLAN_LABEL[plan]}</span>
            </button>
          </div>

          <div className={`action-slot${inOverlay ? ' collapsed' : ''}`}>
            <button
              className="icon-btn"
              title="Scan full site"
              aria-label="Scan full site"
              disabled={scanning}
              onClick={startScan}
              tabIndex={inOverlay ? -1 : 0}
            >
              <Icon name="refresh" size={14} />
            </button>
          </div>

          <div className={`action-slot${inAccount ? ' collapsed' : ''}`}>
            <button
              className={`icon-btn${inSettings ? ' active back-btn' : ''}`}
              title={inSettings ? 'Back' : 'Settings'}
              aria-label={inSettings ? 'Back' : 'Settings'}
              aria-pressed={inSettings}
              onClick={toggleSettings}
              tabIndex={inAccount ? -1 : 0}
            >
              <Icon name={inSettings ? 'arrow-left' : 'settings'} size={14} />
            </button>
          </div>

          <div className={`action-slot${inSettings ? ' collapsed' : ''}`}>
            <button
              className={`icon-btn${inAccount ? ' active back-btn' : ''}`}
              title={inAccount ? 'Back' : 'Account'}
              aria-label={inAccount ? 'Back' : 'Account'}
              aria-pressed={inAccount}
              onClick={toggleAccount}
              tabIndex={inSettings ? -1 : 0}
            >
              <Icon name={inAccount ? 'arrow-left' : 'user'} size={14} />
            </button>
          </div>
        </div>
      </header>
      <div className={`progress-track${scanning ? ' active' : ''}`}>
        <div className="progress-bar" style={{ width: `${progress}%` }} />
      </div>
    </>
  );
}

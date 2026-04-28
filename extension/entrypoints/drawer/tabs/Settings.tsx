import { MetricCard } from '@/components/MetricCard';
import { Row } from '@/components/Row';
import { Toggle } from '@/components/Toggle';
import { Dropdown } from '@/components/Dropdown';
import { Icon, type IconName } from '@/components/Icon';
import { useApp, type Language, type Mode, type Theme } from '@/lib/state';

const LANGUAGES: { value: Language; label: string }[] = [
  { value: 'en', label: 'English' },
  { value: 'es', label: 'Español' },
  { value: 'fr', label: 'Français' },
  { value: 'de', label: 'Deutsch' },
  { value: 'zh', label: '中文' },
  { value: 'ar', label: 'العربية' },
  { value: 'ja', label: '日本語' },
];

const MODES: { key: Mode; label: string; icon: IconName; desc: string }[] = [
  { key: 'normal', label: 'Normal', icon: 'user', desc: 'Essential features with a calm, uncluttered UI.' },
  { key: 'power',  label: 'Power',  icon: 'bolt', desc: 'Every advanced control, chart, and filter exposed.' },
];

const THEMES: { key: Theme; label: string; icon: IconName }[] = [
  { key: 'light',  label: 'Light',  icon: 'sun' },
  { key: 'dark',   label: 'Dark',   icon: 'moon' },
  { key: 'system', label: 'System', icon: 'sparkle' },
];

export function Settings() {
  const {
    theme, setTheme,
    mode, setMode,
    language, setLanguage,
    notifications, setNotifications,
    privacy, setPrivacy,
  } = useApp();

  return (
    <div className="panel">
      <MetricCard title="Experience mode">
        <div className="mode-grid">
          {MODES.map(m => (
            <button
              key={m.key}
              type="button"
              className={`mode-card${mode === m.key ? ' active' : ''}`}
              onClick={() => setMode(m.key)}
              aria-pressed={mode === m.key}
            >
              <div className="mode-icon"><Icon name={m.icon} size={18} /></div>
              <div className="mode-title">{m.label}</div>
              <div className="mode-desc">{m.desc}</div>
            </button>
          ))}
        </div>
      </MetricCard>

      <MetricCard title="Theme">
        <div className="segment">
          {THEMES.map(t => (
            <button
              key={t.key}
              type="button"
              className={`segment-btn${theme === t.key ? ' active' : ''}`}
              onClick={() => setTheme(t.key)}
              aria-pressed={theme === t.key}
            >
              <Icon name={t.icon} size={12} /> {t.label}
            </button>
          ))}
        </div>
      </MetricCard>

      <MetricCard title="Language">
        <Dropdown
          value={language}
          options={LANGUAGES}
          onChange={setLanguage}
          ariaLabel="Extension language"
          buttonLabel={(o) => (
            <>
              <Icon name="globe" size={12} />
              <span>{o.label}</span>
            </>
          )}
        />
      </MetricCard>

      <MetricCard title="Notifications">
        <Row
          label={<><Icon name="bell" size={12} /> Desktop notifications</>}
          value={<Toggle
            on={notifications.desktop}
            onChange={() => setNotifications({ ...notifications, desktop: !notifications.desktop })}
            label="Desktop notifications"
          />}
        />
        <Row
          label={<><Icon name="sparkle" size={12} /> Play sound on alert</>}
          value={<Toggle
            on={notifications.sound}
            onChange={() => setNotifications({ ...notifications, sound: !notifications.sound })}
            label="Sound on alert"
          />}
        />
        <div className="row">
          <span className="row-label">Alert threshold</span>
          <span className="threshold">
            <input
              type="range" min={0} max={100} step={5}
              value={notifications.threshold}
              onChange={(e) => setNotifications({ ...notifications, threshold: Number(e.target.value) })}
              aria-label="Alert threshold"
            />
            <span className="threshold-value">{notifications.threshold}% AI+</span>
          </span>
        </div>
      </MetricCard>

      <MetricCard title="Privacy">
        <Row
          label={<><Icon name="shield" size={12} /> Cloud scanning</>}
          value={<Toggle
            on={privacy.cloud}
            onChange={() => setPrivacy({ ...privacy, cloud: !privacy.cloud })}
            label="Cloud scanning"
          />}
        />
        <Row
          label={<>Cache scan results</>}
          value={<Toggle
            on={privacy.cache}
            onChange={() => setPrivacy({ ...privacy, cache: !privacy.cache })}
            label="Cache scan results"
          />}
        />
        <Row
          label={<>Share anonymised signals</>}
          value={<Toggle
            on={privacy.shareSignals}
            onChange={() => setPrivacy({ ...privacy, shareSignals: !privacy.shareSignals })}
            label="Share anonymised signals"
          />}
        />
        <button
          type="button"
          className="danger-btn"
          onClick={() => {
            if (chrome?.storage?.local) chrome.storage.local.set({ scanHistory: [] });
          }}
        >
          <Icon name="trash" size={12} /> Clear scan history
        </button>
      </MetricCard>

      <div className="legal-note">heynotai v3.2 · settings saved to this browser.</div>
    </div>
  );
}

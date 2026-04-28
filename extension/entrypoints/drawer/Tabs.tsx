import { useLocation, useNavigate } from 'react-router-dom';
import { Icon, type IconName } from '@/components/Icon';

const TABS: { path: string; label: string; icon: IconName }[] = [
  { path: '/home',    label: 'Main',    icon: 'home' },
  { path: '/stats',   label: 'Stats',   icon: 'activity' },
  { path: '/content', label: 'Content', icon: 'layers' },
  { path: '/sources', label: 'Sources', icon: 'globe' },
  { path: '/models',  label: 'Models',  icon: 'sparkle' },
];

export function Tabs() {
  const { pathname } = useLocation();
  const navigate = useNavigate();
  const active = pathname === '/' ? '/home' : pathname;

  return (
    <nav className="tabs" role="tablist">
      {TABS.map(t => (
        <button
          key={t.path}
          type="button"
          role="tab"
          className="tab"
          aria-selected={active === t.path}
          onClick={() => navigate(t.path)}
        >
          <Icon name={t.icon} size={12} />
          {t.label}
        </button>
      ))}
    </nav>
  );
}

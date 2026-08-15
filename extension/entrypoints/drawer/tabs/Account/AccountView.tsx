import { useEffect, useState } from 'react';
import { Icon } from '@/components/Icon';
import { MetricCard } from '@/components/MetricCard';
import { Row } from '@/components/Row';
import { useAuth } from '@/lib/auth-state';
import { avatarUrl, backend } from '@/lib/backend';
import { planLabel } from './helpers';

type Usage = { used: number; total: number | null; resetsOn: string };

export function AccountView() {
  const { user, signOut } = useAuth();
  const usage = useMonthlyUsage(!!user);
  if (!user) return null;
  const avatar = avatarUrl(backend.authStore.record);

  return (
    <div className="panel">
      <MetricCard title="Account">
        <div className="profile-head">
          <div className="avatar">
            {avatar ? (
              <img src={avatar} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover', borderRadius: '50%' }} />
            ) : (
              user.initials
            )}
          </div>
          <div style={{ flex: 1, minWidth: 0 }}>
            <div className="profile-name">{user.name || user.email}</div>
            <div className="profile-email">{user.email}</div>
          </div>
          <span className="pro-tag">{user.plan.toUpperCase()}</span>
        </div>
        <div>
          <Row label="Plan" value={planLabel(user.plan)} />
          <Row
            label="Tokens this month"
            value={usage ? formatUsage(usage) : '—'}
            hint={usage ? `resets ${usage.resetsOn}` : undefined}
          />
          <Row label="Device" value="this browser" />
        </div>
      </MetricCard>

      {/* Sign-out is a website action. This disconnects the extension and
          opens heynotai.com so the user can end the session there too —
          the extension has no way to do that on their behalf. */}
      <button className="signout-btn" onClick={signOut}>
        <Icon name="log-out" size={13} /> Sign out on heynotai.com
      </button>
      <p className="signout-note">
        Disconnects this browser and opens heynotai.com, where your account
        session lives.
      </p>
    </div>
  );
}

function formatUsage(usage: Usage): string {
  const used = usage.used.toLocaleString();
  return usage.total === null
    ? `${used} used`
    : `${used} / ${usage.total.toLocaleString()}`;
}

/** Real monthly token usage from `GET /me/usage` — the same ledger the
 *  website's usage card reads. Replaces the "Tracking coming soon"
 *  placeholder that shipped with the account panel. */
function useMonthlyUsage(enabled: boolean): Usage | null {
  const [usage, setUsage] = useState<Usage | null>(null);

  useEffect(() => {
    if (!enabled) {
      setUsage(null);
      return;
    }
    let cancelled = false;
    void (async () => {
      try {
        const result = await backend.request<Usage>('/me/usage');
        if (!cancelled) setUsage(result);
      } catch {
        // Leave the row on its em-dash rather than inventing a number.
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [enabled]);

  return usage;
}

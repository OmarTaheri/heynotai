import { Icon } from '@/components/Icon';
import { MetricCard } from '@/components/MetricCard';
import { Row } from '@/components/Row';
import { useAuth } from '@/lib/auth-state';
import { avatarUrl, pb } from '@/lib/pocketbase';
import { planLabel } from './helpers';

export function AccountView() {
  const { user, signOut } = useAuth();
  if (!user) return null;
  const avatar = avatarUrl(pb.authStore.record);

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
          <Row label="Scans this month" value="—" hint="Tracking coming soon" />
          <Row label="Device" value="this browser" />
        </div>
      </MetricCard>

      <button className="signout-btn" onClick={signOut}>
        <Icon name="log-out" size={13} /> Sign out
      </button>
    </div>
  );
}

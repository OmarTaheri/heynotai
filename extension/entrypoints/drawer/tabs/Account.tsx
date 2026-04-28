import { useState } from 'react';
import { Icon } from '@/components/Icon';
import { MetricCard } from '@/components/MetricCard';
import { Row } from '@/components/Row';
import { Toggle } from '@/components/Toggle';
import { useAuth } from '@/lib/auth-state';
import { avatarUrl, pb } from '@/lib/pocketbase';

export function Account() {
  const { user, signIn, signUp, signInWithGoogle, confirmMfa, signOut } = useAuth();
  const [tab, setTab] = useState<'login' | 'signup'>('login');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [name, setName] = useState('');
  const [otp, setOtp] = useState('');
  const [mfa, setMfa] = useState<{ mfaId: string; otpId: string } | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [prefs, setPrefs] = useState({
    notify: true, highlight: true, blockAutoplay: false,
  });

  if (!user) {
    return (
      <div className="panel">
        <div className="signin-card">
          <div className="signin-lock"><Icon name="lock" size={20} /></div>
          <div>
            <div className="signin-title">
              {tab === 'login' ? 'Sign in to heynotai' : 'Create your account'}
            </div>
            <div className="signin-desc">
              Sync your scan history, sites, and model choices across browsers. 500 free scans per month.
            </div>
          </div>

          <form
            onSubmit={async (e) => {
              e.preventDefault();
              setError(null);
              setSubmitting(true);
              try {
                if (mfa) {
                  const r = await confirmMfa(mfa.mfaId, mfa.otpId, otp);
                  if (!r.ok && 'error' in r) setError(r.error);
                  return;
                }
                if (tab === 'signup') {
                  const r = await signUp(name, email, password);
                  if (!r.ok && 'error' in r) setError(r.error);
                  return;
                }
                const r = await signIn(email, password);
                if (r.ok) return;
                if ('mfaRequired' in r) {
                  setMfa({ mfaId: r.mfaId, otpId: r.otpId });
                  return;
                }
                setError(r.error);
              } finally {
                setSubmitting(false);
              }
            }}
            className="signin-form"
          >
            {tab === 'signup' && !mfa && (
              <input
                type="text"
                className="signin-input"
                placeholder="Full name"
                value={name}
                onChange={(e) => setName(e.target.value)}
                required
              />
            )}
            {!mfa && (
              <>
                <input
                  type="email"
                  className="signin-input"
                  placeholder="you@domain.com"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  required
                />
                <input
                  type="password"
                  className="signin-input"
                  placeholder="Password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  required
                  minLength={tab === 'signup' ? 8 : undefined}
                />
              </>
            )}
            {mfa && (
              <input
                type="text"
                inputMode="numeric"
                className="signin-input"
                placeholder="Verification code (check your email)"
                value={otp}
                onChange={(e) => setOtp(e.target.value)}
                required
              />
            )}
            {error && <div className="signin-error">{error}</div>}

            <div className="signin-btns">
              <button type="submit" className="btn-primary" disabled={submitting}>
                {submitting
                  ? 'Working…'
                  : mfa
                    ? 'Verify code'
                    : tab === 'signup'
                      ? 'Create account'
                      : 'Continue with Email'}
              </button>
              {!mfa && (
                <button
                  type="button"
                  className="btn-outline"
                  disabled={submitting}
                  onClick={async () => {
                    setError(null);
                    setSubmitting(true);
                    const r = await signInWithGoogle();
                    if (!r.ok && 'error' in r) setError(r.error);
                    setSubmitting(false);
                  }}
                >
                  <span className="tiny-square google" /> Continue with Google
                </button>
              )}
              {!mfa && (
                <button
                  type="button"
                  className="btn-link"
                  onClick={() => {
                    setError(null);
                    setTab(tab === 'login' ? 'signup' : 'login');
                  }}
                >
                  {tab === 'login' ? 'Create an account' : 'I already have an account'}
                </button>
              )}
            </div>
          </form>
        </div>
        <div className="legal-note">
          By continuing you agree to the Terms and Privacy Policy.<br />
          heynotai is an independent tool; not affiliated with any platform.
        </div>
      </div>
    );
  }

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

      <MetricCard title="Preferences">
        <div>
          <Row
            label={<><Icon name="bell" size={12} /> Desktop notifications</>}
            value={<Toggle on={prefs.notify} onChange={() => setPrefs(p => ({ ...p, notify: !p.notify }))} label="Desktop notifications" />}
          />
          <Row
            label={<><Icon name="sparkle" size={12} /> Highlight flagged items</>}
            value={<Toggle on={prefs.highlight} onChange={() => setPrefs(p => ({ ...p, highlight: !p.highlight }))} label="Highlight flagged items" />}
          />
          <Row
            label={<><Icon name="shield" size={12} /> Block autoplay on AI video</>}
            value={<Toggle on={prefs.blockAutoplay} onChange={() => setPrefs(p => ({ ...p, blockAutoplay: !p.blockAutoplay }))} label="Block autoplay on AI video" />}
          />
        </div>
      </MetricCard>

      <button className="signout-btn" onClick={signOut}>
        <Icon name="log-out" size={13} /> Sign out
      </button>
    </div>
  );
}

function planLabel(p: 'check' | 'verify' | 'certify' | 'team'): string {
  switch (p) {
    case 'check': return 'Check · Free';
    case 'verify': return 'Verify · $10/mo';
    case 'certify': return 'Certify · $30/mo';
    case 'team': return 'Team · Multi-seat';
  }
}

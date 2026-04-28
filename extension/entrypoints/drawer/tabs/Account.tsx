import { useEffect, useRef, useState } from 'react';
import { Icon } from '@/components/Icon';
import { MetricCard } from '@/components/MetricCard';
import { Row } from '@/components/Row';
import { useApp } from '@/lib/state';
import { useAuth } from '@/lib/auth-state';
import { avatarUrl, pb } from '@/lib/pocketbase';

export function Account() {
  const { user, signIn, signUp, signInWithGoogle, confirmMfa, signOut } = useAuth();
  const { setView } = useApp();
  const [tab, setTab] = useState<'login' | 'signup'>('login');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [name, setName] = useState('');
  const [otp, setOtp] = useState('');
  const [mfa, setMfa] = useState<{ mfaId: string; otpId: string } | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // After a successful login (user transitions from null → record),
  // jump back to the main view. Doesn't fire when the user opens
  // Account while already signed in.
  const prevUserRef = useRef(user);
  useEffect(() => {
    if (!prevUserRef.current && user) {
      setView('main');
    }
    prevUserRef.current = user;
  }, [user, setView]);

  if (!user) {
    return (
      <div className="panel signin-screen">
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
                  <GoogleIcon /> Continue with Google
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

      <button className="signout-btn" onClick={signOut}>
        <Icon name="log-out" size={13} /> Sign out
      </button>
    </div>
  );
}

function GoogleIcon() {
  return (
    <svg width="15" height="15" viewBox="0 0 24 24" aria-hidden>
      <path
        fill="#4285F4"
        d="M22 12.3c0-.7-.1-1.5-.2-2.2H12v4.1h5.6c-.2 1.3-1 2.4-2 3.1v2.5h3.3c1.9-1.8 3.1-4.4 3.1-7.5z"
      />
      <path
        fill="#34A853"
        d="M12 22c2.7 0 5-1 6.7-2.4l-3.3-2.5c-.9.6-2 1-3.4 1-2.6 0-4.8-1.8-5.6-4.1H2.9V16C4.6 19.6 8 22 12 22z"
      />
      <path
        fill="#FBBC05"
        d="M6.4 14c-.2-.6-.3-1.3-.3-2s.1-1.4.3-2V7.5H2.9C2.3 8.8 2 10.4 2 12s.3 3.2.9 4.5L6.4 14z"
      />
      <path
        fill="#EA4335"
        d="M12 5.9c1.5 0 2.8.5 3.8 1.5l2.9-2.9C16.9 2.9 14.7 2 12 2 8 2 4.6 4.4 2.9 7.5L6.4 10c.8-2.4 3-4.1 5.6-4.1z"
      />
    </svg>
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

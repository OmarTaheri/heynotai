import { useState } from 'react';
import { Icon } from '@/components/Icon';
import { useAuth } from '@/lib/auth-state';
import { GoogleIcon } from './GoogleIcon';

export function SignInScreen() {
  const { signIn, signUp, signInWithGoogle, confirmMfa } = useAuth();
  const [tab, setTab] = useState<'login' | 'signup'>('login');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [name, setName] = useState('');
  const [otp, setOtp] = useState('');
  const [mfa, setMfa] = useState<{ mfaId: string; otpId: string } | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  return (
    <div className="panel signin-screen">
      <div className="signin-card">
        <div className="signin-lock"><Icon name="lock" size={20} /></div>
        <div>
          <div className="signin-title">
            {tab === 'login' ? 'Sign in to heynotai' : 'Create your account'}
          </div>
          <div className="signin-desc">
            Sync your scan history, sites, and model choices across browsers. 100 free tokens per month.
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

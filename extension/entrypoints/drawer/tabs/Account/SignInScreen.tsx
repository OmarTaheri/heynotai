import { useState } from 'react';
import { Icon } from '@/components/Icon';
import { useAuth } from '@/lib/auth-state';

/** Sign-in has no form here on purpose: credentials are only ever entered
 *  on heynotai.com. The extension checks for a website session on its own
 *  and only shows this button when it can't find one. */
export function SignInScreen() {
  const { signIn, openWebsite, connecting } = useAuth();
  const [error, setError] = useState<string | null>(null);

  return (
    <div className="panel signin-screen">
      <div className="signin-card">
        <div className="signin-lock"><Icon name="lock" size={20} /></div>
        <div>
          <div className="signin-title">Sign in to heynotai</div>
          <div className="signin-desc">
            Sign-in happens on heynotai.com. Once you're signed in there, this
            browser connects automatically — scan history, sites, and model
            choices sync across it. 100 free tokens per month.
          </div>
        </div>

        {error && <div className="signin-error">{error}</div>}

        <div className="signin-btns">
          <button
            type="button"
            className="btn-primary"
            disabled={connecting}
            onClick={async () => {
              setError(null);
              const r = await signIn();
              if (!r.ok) setError(r.error);
            }}
          >
            {connecting ? 'Waiting for heynotai.com…' : 'Sign in on heynotai.com'}
          </button>
          <button
            type="button"
            className="btn-link"
            onClick={() => {
              setError(null);
              openWebsite();
            }}
          >
            Open heynotai.com in a tab instead
          </button>
        </div>
      </div>
      <div className="legal-note">
        By continuing you agree to the Terms and Privacy Policy.<br />
        heynotai is an independent tool; not affiliated with any platform.
      </div>
    </div>
  );
}

import { HashRouter, Routes, Route, Navigate } from 'react-router-dom';
import { AppProvider, useApp } from '@/lib/state';
import { AuthProvider, useAuth } from '@/lib/auth-state';
import { Icon } from '@/components/Icon';
import { Header } from './Header';
import { Tabs } from './Tabs';
import { Footer } from './Footer';
import { Home } from './tabs/Home';
import { Stats } from './tabs/Stats';
import { Content } from './tabs/Content';
import { Sources } from './tabs/Sources';
import { Models } from './tabs/Models';
import { Account } from './tabs/Account';
import { Settings } from './tabs/Settings';

function Shell() {
  const { view, setView } = useApp();
  const { user, loading } = useAuth();
  const inOverlay = view !== 'main';
  const needsLogin = !loading && !user && view !== 'account';

  return (
    <div className="app">
      <Header />
      {!inOverlay && <Tabs />}
      <div className={`body${needsLogin ? ' is-locked' : ''}`}>
        <div className="body-content">
          {view === 'account'  ? <Account />
           : view === 'settings' ? <Settings />
           : (
            <Routes>
              <Route path="/" element={<Navigate to="/home" replace />} />
              <Route path="/home"    element={<Home />} />
              <Route path="/stats"   element={<Stats />} />
              <Route path="/content" element={<Content />} />
              <Route path="/sources" element={<Sources />} />
              <Route path="/models"  element={<Models />} />
            </Routes>
          )}
        </div>
        {needsLogin && (
          <div className="login-gate" role="dialog" aria-modal="true">
            <div className="login-gate-card">
              <div className="signin-lock"><Icon name="lock" size={20} /></div>
              <div className="signin-title">Sign in required</div>
              <div className="signin-desc">
                Sign in to use heynotai, sync your scan history, and pick up where you left off.
              </div>
              <button
                type="button"
                className="btn-primary login-gate-btn"
                onClick={() => setView('account')}
              >
                Sign in
              </button>
            </div>
          </div>
        )}
      </div>
      <Footer />
    </div>
  );
}

export function App() {
  return (
    <AuthProvider>
      <AppProvider>
        <HashRouter>
          <Shell />
        </HashRouter>
      </AppProvider>
    </AuthProvider>
  );
}

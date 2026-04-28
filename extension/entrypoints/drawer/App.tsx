import { HashRouter, Routes, Route, Navigate } from 'react-router-dom';
import { AppProvider, useApp } from '@/lib/state';
import { AuthProvider } from '@/lib/auth-state';
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
  const { view } = useApp();
  const inOverlay = view !== 'main';

  return (
    <div className="app">
      <Header />
      {!inOverlay && <Tabs />}
      <div className="body">
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

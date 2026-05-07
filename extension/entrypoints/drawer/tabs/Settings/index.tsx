import { useApp } from '@/lib/state';
import {
  ExperienceModeCard,
  LanguageCard,
  NotificationsCard,
  PrivacyCard,
  ThemeCard,
} from './cards';

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
      <ExperienceModeCard mode={mode} setMode={setMode} />
      <ThemeCard theme={theme} setTheme={setTheme} />
      <LanguageCard language={language} setLanguage={setLanguage} />
      <NotificationsCard notifications={notifications} setNotifications={setNotifications} />
      <PrivacyCard privacy={privacy} setPrivacy={setPrivacy} />
      <div className="legal-note">heynotai v0.1 · settings saved to this browser.</div>
    </div>
  );
}

import { useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { useApp } from '@/lib/state';
import { useAuth } from '@/lib/auth-state';
import { SignInScreen } from './SignInScreen';
import { AccountView } from './AccountView';

export function Account() {
  const { user } = useAuth();
  const { setView } = useApp();
  const navigate = useNavigate();

  // After a successful login (user transitions from null → record),
  // land them on the home tab. Doesn't fire when the user opens
  // Account while already signed in.
  const prevUserRef = useRef(user);
  useEffect(() => {
    if (!prevUserRef.current && user) {
      navigate('/home', { replace: true });
      setView('main');
    }
    prevUserRef.current = user;
  }, [user, setView, navigate]);

  return user ? <AccountView /> : <SignInScreen />;
}

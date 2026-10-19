import { useEffect, type ReactNode } from 'react';
import { useAccountStore } from '../accountStore';
import { startAccountRuntime } from '../runtime/sessionRuntime';
import { LoginScreen } from './LoginScreen';
import { StartupScreen } from './StartupScreen';

/**
 * Account-mode entry point (loaded lazily, together with the Supabase client). Students
 * see the app only with a session; otherwise the access-code screen.
 */
export default function AccountGate({ children }: { children: ReactNode }) {
  const phase = useAccountStore((state) => state.phase);

  useEffect(() => {
    startAccountRuntime();
  }, []);

  switch (phase) {
    case 'starting':
      return <StartupScreen />;
    case 'unreachable':
      return <StartupScreen unreachable />;
    case 'signed-out':
      return <LoginScreen />;
    case 'signed-in':
      return children;
  }
}

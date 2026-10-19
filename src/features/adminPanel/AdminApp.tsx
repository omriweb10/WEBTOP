import { useEffect } from 'react';
import { accountMode } from '../../config/backend';
import { StartupScreen } from '../account/components/StartupScreen';
import { AdminLogin } from './components/AdminLogin';
import { AdminShell } from './components/AdminShell';
import { NotConfigured } from './components/NotConfigured';
import { useAdminAuth } from './state/adminAuthStore';

/**
 * The administrator panel (#/admin), loaded on demand. Access requires a Supabase Auth
 * account listed in public.admins; every action is authorised again by the database.
 */
export default function AdminApp() {
  if (!accountMode) return <NotConfigured />;
  return <AdminGate />;
}

/** Checks the admin session with the server before showing anything. */
function AdminGate() {
  const phase = useAdminAuth((state) => state.phase);
  const check = useAdminAuth((state) => state.check);

  useEffect(() => {
    void check();
  }, [check]);

  if (phase === 'checking') return <StartupScreen />;
  if (phase === 'signed-out') return <AdminLogin />;
  return <AdminShell />;
}

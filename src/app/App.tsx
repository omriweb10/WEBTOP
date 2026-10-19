import { lazy, Suspense, useEffect } from 'react';
import { ConfirmHost } from '../components/ui/ConfirmHost';
import { ToastHost } from '../components/ui/ToastHost';
import { Sidebar } from '../components/layout/Sidebar';
import { accountMode } from '../config/backend';
import { StartupScreen } from '../features/account/components/StartupScreen';
import { EditCodeDialog } from '../features/admin/components/EditCodeDialog';
import { PrintableWeek } from '../features/timetable/components/PrintableWeek';
import { UpdateBanner } from '../features/settings/components/UpdateBanner';
import { onStorageProblem } from '../services/storage/appStorage';
import { toast } from '../store/uiStore';
import { RouteView } from './RouteView';
import { useRoute } from './router';
import styles from './App.module.css';

// Loaded on demand so the local-only build never downloads the backend client or admin UI.
const AccountGate = lazy(() => import('../features/account/components/AccountGate'));
const AdminApp = lazy(() => import('../features/adminPanel/AdminApp'));

/** The student app, behind the access-code gate when a backend is configured. */
function StudentApp() {
  if (!accountMode) return <RouteView />;
  return (
    <Suspense fallback={<StartupScreen />}>
      <AccountGate>
        <RouteView />
      </AccountGate>
    </Suspense>
  );
}

/**
 * Root shell: paints the iOS safe areas, hosts the current screen and the app-wide
 * overlays (sidebar, dialogs, toasts, update banner, print layout). #/admin hosts the
 * separate administrator panel.
 */
export function App() {
  const route = useRoute();

  // Surface storage problems (unreadable data was quarantined, or a save failed).
  useEffect(
    () => onStorageProblem((problem) => toast(problem.message, { tone: 'error', duration: problem.kind === 'load' ? 9000 : 6000 })),
    [],
  );

  return (
    <>
      <div className={styles.shell}>
        <div className={styles.safeTop} aria-hidden="true" />
        <div className={styles.screen}>
          {route.name === 'admin' ? (
            <Suspense fallback={<StartupScreen />}>
              <AdminApp />
            </Suspense>
          ) : (
            <StudentApp />
          )}
        </div>
        <div className={styles.safeBottom} aria-hidden="true" />
        <Sidebar />
        <EditCodeDialog />
        <ConfirmHost />
        <UpdateBanner />
        <ToastHost />
      </div>
      <PrintableWeek />
    </>
  );
}

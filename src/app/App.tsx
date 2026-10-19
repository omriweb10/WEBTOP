import { useEffect } from 'react';
import { ConfirmHost } from '../components/ui/ConfirmHost';
import { ToastHost } from '../components/ui/ToastHost';
import { Sidebar } from '../components/layout/Sidebar';
import { EditCodeDialog } from '../features/admin/components/EditCodeDialog';
import { PrintableWeek } from '../features/timetable/components/PrintableWeek';
import { UpdateBanner } from '../features/settings/components/UpdateBanner';
import { onStorageProblem } from '../services/storage/appStorage';
import { toast } from '../store/uiStore';
import { RouteView } from './RouteView';
import styles from './App.module.css';

/**
 * Root shell: paints the iOS safe areas, hosts the current screen and the app-wide
 * overlays (sidebar, dialogs, toasts, update banner, print layout).
 */
export function App() {
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
          <RouteView />
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

import { applyUpdate, usePwaStore } from '../../../services/pwa/serviceWorkerClient';
import styles from './UpdateBanner.module.css';

/** Non-blocking banner shown when a new app version has been downloaded. */
export function UpdateBanner() {
  const status = usePwaStore((state) => state.status);
  if (status !== 'update-available') return null;
  return (
    <div className={styles.banner} role="status">
      <span>גרסה חדשה של האפליקציה מוכנה.</span>
      <button type="button" className={styles.button} onClick={applyUpdate}>
        רענון
      </button>
      <button type="button" className={styles.later} onClick={() => usePwaStore.setState({ status: 'idle' })}>
        אחר כך
      </button>
    </div>
  );
}

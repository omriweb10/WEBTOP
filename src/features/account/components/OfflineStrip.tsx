import { Icon } from '../../../components/ui/Icon';
import { useAccountStore } from '../accountStore';
import styles from './OfflineStrip.module.css';

/** Shown under the app bar while the server cannot be reached (account mode). */
export function OfflineStrip() {
  const offline = useAccountStore((state) => state.offline);
  const refresh = useAccountStore((state) => state.actions?.refresh);
  if (!offline) return null;
  return (
    <div className={styles.strip} role="status">
      <Icon name="cloudOff" size={18} />
      <p className={styles.text}>אין חיבור לשרת · מוצגים הנתונים האחרונים שנשמרו. שינויים יתאפשרו כשהחיבור יחזור.</p>
      {refresh && (
        <button type="button" className={styles.button} onClick={() => void refresh()}>
          רענון
        </button>
      )}
    </div>
  );
}

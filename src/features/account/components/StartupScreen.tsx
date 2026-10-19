import { Button } from '../../../components/ui/Button';
import { Icon } from '../../../components/ui/Icon';
import { useAccountStore } from '../accountStore';
import styles from './StartupScreen.module.css';

/** Shown while the stored session is checked, or when it cannot be checked at all. */
export function StartupScreen({ unreachable = false }: { unreachable?: boolean }) {
  const refresh = useAccountStore((state) => state.actions?.refresh);
  return (
    <div className={styles.page} role="status" aria-live="polite">
      <Icon name={unreachable ? 'cloudOff' : 'school'} size={44} className={styles.icon} />
      {unreachable ? (
        <>
          <p className={styles.title}>אין חיבור לשרת</p>
          <p className={styles.text}>החיבור שלך שמור במכשיר, אבל צריך רשת כדי לטעון את המערכת בפעם הראשונה.</p>
          <Button icon="sync" onClick={() => void refresh?.()} disabled={!refresh}>
            ניסיון חוזר
          </Button>
        </>
      ) : (
        <>
          <span className={styles.spinner} aria-hidden="true" />
          <p className={styles.text}>בודק את החיבור…</p>
        </>
      )}
    </div>
  );
}

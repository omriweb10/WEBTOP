import { navigate } from '../../../app/router';
import { Button } from '../../../components/ui/Button';
import { Icon } from '../../../components/ui/Icon';
import styles from './AdminLogin.module.css';

/** Shown at #/admin in a build without Supabase settings. */
export function NotConfigured() {
  return (
    <div className={styles.page}>
      <div className={styles.card}>
        <div className={styles.brand}>
          <Icon name="adminPanel" size={26} />
          <span>ממשק ניהול</span>
        </div>
        <h1 className={styles.title}>השרת אינו מוגדר בגרסה הזו</h1>
        <p className={styles.lead}>
          ממשק הניהול דורש פרויקט Supabase. הגדירו את VITE_SUPABASE_URL ו‑VITE_SUPABASE_ANON_KEY בבנייה (ראו docs/supabase-setup.md).
          עד אז האפליקציה פועלת במצב מקומי בלבד.
        </p>
        <Button variant="secondary" onClick={() => navigate({ name: 'schedule', tab: 'timetable' })}>
          חזרה לאפליקציה
        </Button>
      </div>
    </div>
  );
}

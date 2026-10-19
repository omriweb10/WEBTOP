import { useState } from 'react';
import { Avatar } from '../../../components/ui/Avatar';
import { Button } from '../../../components/ui/Button';
import { confirm } from '../../../components/ui/confirmStore';
import { SectionCard } from '../../../components/ui/SectionCard';
import { toast } from '../../../store/uiStore';
import { useAccountStore, useAccountSummary } from '../accountStore';
import styles from './AccountSection.module.css';

/** "DD/MM/YYYY HH:MM" in Hebrew locale, or null. */
function formatDateTime(iso: string | null): string | null {
  if (!iso) return null;
  const date = new Date(iso);
  return Number.isNaN(date.getTime()) ? null : date.toLocaleString('he-IL', { dateStyle: 'short', timeStyle: 'short' });
}

/** Settings card for the signed-in student: who is signed in, since when, and logout. */
export function AccountSection() {
  const summary = useAccountSummary();
  const avatarUrl = useAccountStore((state) => state.avatarUrl);
  const logout = useAccountStore((state) => state.actions?.logout);
  const [busy, setBusy] = useState(false);
  if (!summary) return null;
  const since = formatDateTime(summary.sessionStartedAt);

  /** Ends the session on the server (frees the code for another device). */
  const onLogout = async () => {
    if (!logout) return;
    const ok = await confirm({
      title: 'התנתקות',
      message: 'להתנתק מהמכשיר הזה? אחרי ההתנתקות אפשר יהיה להתחבר עם הקוד בכל מכשיר, כולל זה.',
      confirmLabel: 'התנתקות',
      tone: 'danger',
    });
    if (!ok) return;
    setBusy(true);
    const result = await logout();
    setBusy(false);
    if (result === 'offline') toast('צריך חיבור לאינטרנט כדי להתנתק: ההתנתקות משחררת את הקוד בשרת.', { tone: 'error', duration: 6000 });
    if (result === 'failed') toast('ההתנתקות נכשלה. נסו שוב בעוד רגע.', { tone: 'error' });
  };

  return (
    <SectionCard id="account" title="החשבון שלי">
      <div className={styles.body}>
        <div className={styles.identity}>
          <Avatar name={summary.displayName} src={avatarUrl} size={64} />
          <div className={styles.text}>
            <p className={styles.name}>{summary.displayName}</p>
            {(summary.className || summary.schoolName) && (
              <p className={styles.meta}>{[summary.className, summary.schoolName].filter(Boolean).join(' · ')}</p>
            )}
            {since && <p className={styles.meta}>מחובר/ת במכשיר הזה מאז {since}</p>}
          </div>
        </div>
        {summary.bio && <p className={styles.bio}>{summary.bio}</p>}
        <p className={styles.note}>
          החיבור נשמר במכשיר הזה ללא הגבלת זמן — גם אחרי סגירה, הפעלה מחדש או חוסר פעילות — עד שתתנתקו, או עד שהמנהל ינתק אותו
          או יבטל את הקוד. אם המערכת תמחק את נתוני האתר (למשל ניקוי נתוני Safari או הסרת האפליקציה ממסך הבית), יהיה צורך
          להתחבר מחדש, ואם הקוד עדיין רשום כמחובר — לבקש מהמנהל לנתק את החיבור הקודם.
        </p>
        <Button icon="logout" variant="danger" disabled={busy || !logout} onClick={() => void onLogout()}>
          {busy ? 'מתנתק…' : 'התנתקות'}
        </Button>
      </div>
    </SectionCard>
  );
}

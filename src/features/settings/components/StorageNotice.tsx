import { useEffect, useState } from 'react';
import { Button } from '../../../components/ui/Button';
import { localStore, requestPersistentStorage } from '../../../services/storage/appStorage';
import styles from './SettingsScreen.module.css';

/** Explains where data lives and what can erase it; offers to request persistent storage. */
export function StorageNotice() {
  const [persisted, setPersisted] = useState<boolean | null>(null);

  useEffect(() => {
    let active = true;
    navigator.storage
      ?.persisted?.()
      .then((value) => active && setPersisted(value))
      .catch(() => undefined);
    return () => {
      active = false;
    };
  }, []);

  return (
    <div className={styles.notice} role="note">
      <p>
        <strong>הנתונים נשמרים רק במכשיר הזה</strong> (אחסון מקומי של הדפדפן). מחיקת נתוני אתרים ב‑Safari, הסרת האפליקציה
        ממסך הבית או מעבר לכתובת אתר אחרת עלולים למחוק את השינויים. ב‑iPhone, לאפליקציה שנוספה למסך הבית יש אחסון נפרד
        מ‑Safari — יש לייבא את הנתונים מתוך האפליקציה עצמה.
      </p>
      <p>מומלץ לייצא גיבוי JSON מדי פעם (במצב העריכה).</p>
      {!localStore.persistent && <p className={styles.warning}>האחסון המקומי אינו זמין כרגע — שינויים לא יישמרו אחרי סגירה.</p>}
      {persisted === false && (
        <Button
          icon="lock"
          onClick={() =>
            void requestPersistentStorage().then((value) => {
              setPersisted(value);
            })
          }
        >
          בקשת אחסון קבוע מהדפדפן
        </Button>
      )}
      {persisted === true && <p className={styles.ok}>הדפדפן אישר אחסון קבוע לאתר הזה.</p>}
    </div>
  );
}

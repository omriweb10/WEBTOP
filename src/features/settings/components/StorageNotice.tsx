import { useEffect, useState } from 'react';
import { Button } from '../../../components/ui/Button';
import { localStore, requestPersistentStorage } from '../../../services/storage/appStorage';
import styles from './SettingsScreen.module.css';

/** Local storage status: backup advice, unavailable storage, and a persistent-storage request. */
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
      <p>מומלץ לייצא גיבוי JSON מדי פעם (בכלי העריכה).</p>
      {!localStore.persistent && <p className={styles.warning}>לא ניתן לשמור נתונים בדפדפן הזה כרגע — שינויים לא יישמרו אחרי סגירה.</p>}
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

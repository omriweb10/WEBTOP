import { useState } from 'react';
import { navigate } from '../../../app/router';
import { ScreenFrame } from '../../../components/layout/ScreenFrame';
import { Button } from '../../../components/ui/Button';
import { SectionCard } from '../../../components/ui/SectionCard';
import { checkForUpdate, usePwaStore } from '../../../services/pwa/serviceWorkerClient';
import { toast } from '../../../store/uiStore';
import { useEditModeStore } from '../../admin/editModeStore';
import { StorageNotice } from './StorageNotice';
import styles from './SettingsScreen.module.css';

/** About / settings: unofficial-project disclaimer, version & offline status, storage notes. */
export function SettingsScreen() {
  const editing = useEditModeStore((state) => state.unlocked);
  const lock = useEditModeStore((state) => state.lock);
  const workerVersion = usePwaStore((state) => state.workerVersion);
  const hasWorker = usePwaStore((state) => state.registration !== null);
  const [checking, setChecking] = useState(false);

  /** Manually looks for a newer deployed version. */
  const onCheck = async () => {
    setChecking(true);
    try {
      const found = await checkForUpdate();
      toast(found ? 'נמצאה גרסה חדשה — היא תוצע לרענון בעוד רגע' : 'האפליקציה מעודכנת');
    } catch {
      toast('לא ניתן לבדוק עדכונים כרגע (אין חיבור?)', { tone: 'error' });
    } finally {
      setChecking(false);
    }
  };

  return (
    <ScreenFrame title="הגדרות ואודות">
      <div className={styles.scroll}>
        <SectionCard id="about" title="אודות">
          <div className={styles.body}>
            <p className={styles.disclaimer}>
              <strong>פרויקט אישי לא רשמי.</strong> האפליקציה בהשראת ממשק WEBTOP אך אינה קשורה ל‑WEBTOP, ליצרנית שלה, למשרד
              החינוך או לבית ספר כלשהו, ואינה מייצגת אותם.
            </p>
            <ul className={styles.facts}>
              <li>אין התחברות, אין איסוף סיסמאות ואין שימוש בשרתים או בממשקים של WEBTOP.</li>
              <li>כל הנתונים (מערכת, הודעות, אירועים) מוזנים ונשמרים מקומית במכשיר בלבד.</li>
              <li>זו אפליקציית רשת (PWA) שמותקנת דרך „הוספה למסך הבית” — לא אפליקציה חתומה מה‑App Store.</li>
            </ul>
          </div>
        </SectionCard>

        <SectionCard id="version" title="גרסה ועבודה ללא רשת">
          <div className={styles.body}>
            <dl className={styles.meta}>
              <dt>גרסת אפליקציה</dt>
              <dd>{__APP_VERSION__}</dd>
              <dt>נבנתה</dt>
              <dd>{new Date(__BUILD_TIME__).toLocaleString('he-IL')}</dd>
              <dt>מטמון לא־מקוון</dt>
              <dd>{hasWorker ? `פעיל${workerVersion ? ` (${workerVersion})` : ''}` : 'לא פעיל בדפדפן הזה'}</dd>
            </dl>
            {hasWorker && (
              <Button icon="restart" disabled={checking} onClick={() => void onCheck()}>
                בדיקת עדכונים
              </Button>
            )}
          </div>
        </SectionCard>

        <SectionCard id="storage" title="שמירת נתונים">
          <div className={styles.body}>
            <StorageNotice />
          </div>
        </SectionCard>

        {editing && (
          <SectionCard id="edit" title="מצב עריכה מקומי">
            <div className={styles.body}>
              <div className={styles.row}>
                <Button variant="primary" icon="edit" onClick={() => navigate({ name: 'admin' })}>
                  כלי עריכה
                </Button>
                <Button
                  icon="lock"
                  onClick={() => {
                    lock();
                    toast('יצאת ממצב העריכה');
                  }}
                >
                  יציאה ממצב עריכה
                </Button>
              </div>
            </div>
          </SectionCard>
        )}
      </div>
    </ScreenFrame>
  );
}

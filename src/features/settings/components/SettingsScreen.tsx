import { useState } from 'react';
import { navigate } from '../../../app/router';
import { ScreenFrame } from '../../../components/layout/ScreenFrame';
import { Button } from '../../../components/ui/Button';
import { SectionCard } from '../../../components/ui/SectionCard';
import { accountMode } from '../../../config/backend';
import { checkForUpdate, usePwaStore } from '../../../services/pwa/serviceWorkerClient';
import { toast } from '../../../store/uiStore';
import { AccountSection } from '../../account/components/AccountSection';
import { useEditModeStore } from '../../admin/editModeStore';
import { ThemeSelector } from '../../../theme/components/ThemeSelector';
import { AboutSection } from './AboutSection';
import styles from './SettingsScreen.module.css';

/** Settings and About: account, appearance, what the app is, version & offline status, edit mode. */
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
        {accountMode && <AccountSection />}
        <SectionCard id="appearance" title="מראה">
          <div className={styles.body}>
            <ThemeSelector />
          </div>
        </SectionCard>
        <AboutSection />

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

        {editing && (
          <SectionCard id="edit" title={accountMode ? 'עריכת המערכת שלי' : 'מצב עריכה'}>
            <div className={styles.body}>
              <div className={styles.row}>
                {!accountMode && (
                  <Button variant="primary" icon="edit" onClick={() => navigate({ name: 'tools' })}>
                    כלי עריכה
                  </Button>
                )}
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

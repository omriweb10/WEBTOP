import { ScreenFrame } from '../../../components/layout/ScreenFrame';
import { SectionCard } from '../../../components/ui/SectionCard';
import { PresetManager } from '../../presets/components/PresetManager';
import { StorageNotice } from '../../settings/components/StorageNotice';
import { DataTransferSection } from './DataTransferSection';
import { ProfileForm } from './ProfileForm';
import { ResetSection } from './ResetSection';
import styles from './AdminScreen.module.css';

/** Edit-mode tools: profile, subject presets, backup/import and resets. */
export function AdminScreen() {
  return (
    <ScreenFrame title="כלי עריכה מקומיים">
      <div className={styles.scroll}>
        <p className={styles.intro}>
          כל השינויים כאן חלים על העותק האישי שלך במכשיר הזה בלבד. אין חיבור ל‑WEBTOP ואין שליחת נתונים לשום שרת. לעריכת שיעור
          — יש להקיש עליו במסך מערכת השעות.
        </p>
        <SectionCard id="admin-profile" title="פרטי תצוגה">
          <div className={styles.sectionBody}>
            <ProfileForm />
          </div>
        </SectionCard>
        <SectionCard id="admin-presets" title="תבניות מקצועות (מורה, חדר, צבע)">
          <PresetManager />
        </SectionCard>
        <SectionCard id="admin-data" title="גיבוי, ייצוא וייבוא">
          <div className={styles.sectionBody}>
            <DataTransferSection />
            <StorageNotice />
          </div>
        </SectionCard>
        <SectionCard id="admin-reset" title="איפוס">
          <div className={styles.sectionBody}>
            <ResetSection />
          </div>
        </SectionCard>
      </div>
    </ScreenFrame>
  );
}

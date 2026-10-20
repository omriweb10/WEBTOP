import { ScreenFrame } from '../../../components/layout/ScreenFrame';
import { STUDENT_CARD_TITLE } from '../domain/studentCardEntries';
import styles from './StudentCardScreen.module.css';
import { StudentCardMenu } from './StudentCardMenu';
import { StudentNamePanel } from './StudentNamePanel';

/** כרטיס תלמיד: the student's name and the section's screens (opened from the side menu). */
export function StudentCardScreen() {
  return (
    <ScreenFrame title={STUDENT_CARD_TITLE}>
      <StudentNamePanel />
      <div className={styles.gap} />
      <StudentCardMenu />
    </ScreenFrame>
  );
}

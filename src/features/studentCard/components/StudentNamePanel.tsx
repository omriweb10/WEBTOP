import { useStudentName } from '../hooks/useStudentName';
import styles from './StudentNamePanel.module.css';

/** "שם התלמיד/ה" card at the top of the Student Card screens: small label, then the name. */
export function StudentNamePanel() {
  const name = useStudentName();
  return (
    <section className={styles.panel} aria-labelledby="student-name-label">
      <div className={styles.field}>
        <h2 id="student-name-label" className={styles.label}>
          שם התלמיד/ה
        </h2>
        <p className={styles.name} data-testid="student-name">
          {name || '—'}
        </p>
      </div>
    </section>
  );
}

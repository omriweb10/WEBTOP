import { navigate } from '../../../app/router';
import { Icon } from '../../../components/ui/Icon';
import { STUDENT_CARD_ENTRIES } from '../domain/studentCardEntries';
import styles from './StudentCardMenu.module.css';

/** The Student Card's list of screens; each row opens its screen. */
export function StudentCardMenu() {
  return (
    <nav className={styles.menu} aria-label="כרטיס תלמיד">
      <ul className={styles.list}>
        {STUDENT_CARD_ENTRIES.map((entry) => (
          <li key={entry.id}>
            <button type="button" className={styles.item} onClick={() => navigate(entry.route)}>
              <Icon name={entry.icon} size={22} className={styles.icon} />
              <span className={styles.label}>{entry.label}</span>
              <Icon name="chevronLeft" size={22} className={styles.chevron} />
            </button>
          </li>
        ))}
      </ul>
    </nav>
  );
}

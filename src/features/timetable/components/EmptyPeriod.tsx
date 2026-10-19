import { Icon } from '../../../components/ui/Icon';
import styles from './EmptyPeriod.module.css';

interface EmptyPeriodProps {
  /** When provided (edit mode) the empty cell becomes an "add lesson" button. */
  onActivate?: () => void;
  periodLabel: string;
}

/**
 * An empty period is a real state, rendered as a compact blank row exactly like the
 * reference. Screen readers still hear "שעה פנויה" so the row is never ambiguous.
 */
export function EmptyPeriod({ onActivate, periodLabel }: EmptyPeriodProps) {
  if (onActivate) {
    return (
      <button type="button" className={styles.add} onClick={onActivate} aria-label={`הוספת שיעור בשעה ${periodLabel}`}>
        <Icon name="add" size={18} />
        <span>הוספת שיעור</span>
      </button>
    );
  }
  return <span className="visually-hidden">שעה פנויה</span>;
}

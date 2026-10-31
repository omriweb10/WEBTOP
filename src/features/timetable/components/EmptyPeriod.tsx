import { Icon } from '../../../components/ui/Icon';
import { cx } from '../../../utils/classNames';
import styles from './EmptyPeriod.module.css';

interface EmptyPeriodProps {
  /** When provided (edit mode) the empty cell becomes an "add lesson" button. */
  onActivate?: () => void;
  periodLabel: string;
  /** Extra class for the add button (e.g. the grid's card margin). */
  className?: string;
}

/**
 * An empty period is a real state, rendered as a genuinely blank cell exactly like the
 * reference. Screen readers still hear "שעה פנויה" so the row is never ambiguous.
 */
export function EmptyPeriod({ onActivate, periodLabel, className }: EmptyPeriodProps) {
  if (onActivate) {
    return (
      <button type="button" className={cx(styles.add, className)} onClick={onActivate} aria-label={`הוספת שיעור בשעה ${periodLabel}`}>
        <Icon name="add" size={18} />
        <span>הוספת שיעור</span>
      </button>
    );
  }
  return <span className="visually-hidden">שעה פנויה</span>;
}

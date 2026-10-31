import type { Lesson, Period } from '../../../../schemas/timetable';
import { formatPeriodLabel } from '../../domain/periods';
import { EmptyPeriod } from '../EmptyPeriod';
import { LessonCard } from '../LessonCard';
import styles from './TimetableGrid.module.css';

interface PeriodRowProps {
  period: Period;
  /** The lesson in this period, or null for an empty period. */
  lesson: Lesson | null;
  /** Edit mode: opens the editor for this period. Undefined = read-only. */
  onEdit?: () => void;
}

/** One period: its number and times (25%), then its lesson card or a genuinely empty slot (75%). */
export function PeriodRow({ period, lesson, onEdit }: PeriodRowProps) {
  const label = formatPeriodLabel(period);
  return (
    <div role="row" className={styles.row}>
      <div role="rowheader" className={styles.time}>
        {label}
      </div>
      <div role="cell" className={styles.slot}>
        {lesson ? (
          <LessonCard lesson={lesson} className={styles.card} onActivate={onEdit} actionLabel={`עריכת שעה ${period.number}`} />
        ) : (
          <EmptyPeriod periodLabel={label} className={styles.card} onActivate={onEdit} />
        )}
      </div>
    </div>
  );
}

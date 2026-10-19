import type { DayId, Timetable } from '../../../schemas/timetable';
import { cx } from '../../../utils/classNames';
import { getDayInfo } from '../domain/days';
import { formatPeriodLabel } from '../domain/periods';
import { getDayRows, type Slot } from '../domain/timetableOps';
import { EmptyPeriod } from './EmptyPeriod';
import { LessonCard } from './LessonCard';
import styles from './TimetableTable.module.css';

interface TimetableTableProps {
  timetable: Timetable;
  day: DayId;
  /** Edit mode: called with the tapped slot. Undefined = read-only view. */
  onEditSlot?: (slot: Slot) => void;
  /** Slide direction for the day-change animation. */
  direction: 1 | -1 | 0;
}

/** Two-column day table ("שעה/יום" | day name) with one row per period, empty ones included. */
export function TimetableTable({ timetable, day, onEditSlot, direction }: TimetableTableProps) {
  const info = getDayInfo(day);
  const rows = getDayRows(timetable, day);
  return (
    <table
      className={cx(styles.table, direction === 1 && styles.fromLeft, direction === -1 && styles.fromRight)}
      aria-label={`מערכת שעות ליום ${info.name}`}
    >
      <thead>
        <tr>
          <th scope="col" className={styles.periodHead}>
            שעה/יום
          </th>
          <th scope="col">{info.name}</th>
        </tr>
      </thead>
      <tbody>
        {rows.map(({ period, index, lesson }) => {
          const label = formatPeriodLabel(period);
          const slot = { day, index };
          return (
            <tr key={period.number} className={lesson ? undefined : styles.emptyRow}>
              <th scope="row" className={styles.period}>
                {label}
              </th>
              <td className={styles.cell}>
                {lesson ? (
                  <LessonCard
                    lesson={lesson}
                    onActivate={onEditSlot ? () => onEditSlot(slot) : undefined}
                    actionLabel={`עריכת שעה ${period.number}`}
                  />
                ) : (
                  <EmptyPeriod periodLabel={label} onActivate={onEditSlot ? () => onEditSlot(slot) : undefined} />
                )}
              </td>
            </tr>
          );
        })}
      </tbody>
    </table>
  );
}

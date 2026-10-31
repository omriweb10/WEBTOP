import type { DayId, Timetable } from '../../../../schemas/timetable';
import { cx } from '../../../../utils/classNames';
import { getDayInfo } from '../../domain/days';
import { getDayRows, type Slot } from '../../domain/timetableOps';
import { PeriodRow } from './PeriodRow';
import { TimetableGridHeader } from './TimetableGridHeader';
import styles from './TimetableGrid.module.css';

interface TimetableGridProps {
  timetable: Timetable;
  day: DayId;
  /** Edit mode: called with the tapped slot. Undefined = read-only view. */
  onEditSlot?: (slot: Slot) => void;
  /** Slide direction for the day-change animation. */
  direction: 1 | -1 | 0;
}

/**
 * One school day as Webtop shows it: a two-column CSS grid (times | lessons) under a
 * sticky header, with a row for every period of the timetable — empty ones included.
 * Accessible as a table (role="table" with rows, row headers and cells).
 */
export function TimetableGrid({ timetable, day, onEditSlot, direction }: TimetableGridProps) {
  const info = getDayInfo(day);
  return (
    <div
      role="table"
      aria-label={`מערכת שעות ליום ${info.name}`}
      className={cx(styles.grid, direction === 1 && styles.fromLeft, direction === -1 && styles.fromRight)}
    >
      <TimetableGridHeader dayName={info.name} />
      {getDayRows(timetable, day).map(({ period, index, lesson }) => (
        <PeriodRow key={period.number} period={period} lesson={lesson} onEdit={onEditSlot ? () => onEditSlot({ day, index }) : undefined} />
      ))}
    </div>
  );
}

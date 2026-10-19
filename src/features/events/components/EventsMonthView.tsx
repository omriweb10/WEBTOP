import type { SchoolEvent } from '../../../schemas/content';
import { cx } from '../../../utils/classNames';
import { hebrewMonthLabel, toIsoDate } from '../../../utils/dates';
import { IconButton } from '../../../components/ui/IconButton';
import { monthGrid } from '../domain/eventOps';
import styles from './EventsMonthView.module.css';

const WEEKDAY_LETTERS = ['א', 'ב', 'ג', 'ד', 'ה', 'ו', 'ש'];

interface EventsMonthViewProps {
  month: Date;
  events: readonly SchoolEvent[];
  selectedDate: string | null;
  onShiftMonth: (delta: number) => void;
  onSelectDate: (iso: string | null) => void;
}

/** Compact month calendar (Sunday-first) with dots on days that have exams/events. */
export function EventsMonthView({ month, events, selectedDate, onShiftMonth, onSelectDate }: EventsMonthViewProps) {
  const today = toIsoDate(new Date());
  const byDate = new Map<string, SchoolEvent[]>();
  for (const event of events) byDate.set(event.date, [...(byDate.get(event.date) ?? []), event]);

  return (
    <div className={styles.calendar}>
      <div className={styles.toolbar}>
        <IconButton icon="chevronLeft" label="החודש הקודם" className={styles.prev} onClick={() => onShiftMonth(-1)} />
        <h2 className={styles.month} aria-live="polite">
          {hebrewMonthLabel(month)}
        </h2>
        <IconButton icon="chevronLeft" label="החודש הבא" onClick={() => onShiftMonth(1)} />
      </div>
      <div className={styles.grid} role="grid" aria-label={hebrewMonthLabel(month)}>
        {WEEKDAY_LETTERS.map((letter) => (
          <span key={letter} className={styles.weekday} role="columnheader">
            {letter}
          </span>
        ))}
        {monthGrid(month).map((date) => {
          const iso = toIsoDate(date);
          const items = byDate.get(iso) ?? [];
          const outside = date.getMonth() !== month.getMonth();
          return (
            <button
              key={iso}
              type="button"
              role="gridcell"
              aria-selected={selectedDate === iso}
              aria-label={`${date.getDate()}${items.length ? `, ${items.length} פריטים` : ''}`}
              className={cx(styles.day, outside && styles.outside, iso === today && styles.today, selectedDate === iso && styles.selected)}
              onClick={() => onSelectDate(selectedDate === iso ? null : iso)}
            >
              <span>{date.getDate()}</span>
              {items.length > 0 && (
                <span className={styles.dots} aria-hidden="true">
                  {items.slice(0, 3).map((item) => (
                    <span key={item.id} className={cx(styles.dot, item.kind === 'exam' ? styles.exam : styles.event)} />
                  ))}
                </span>
              )}
            </button>
          );
        })}
      </div>
    </div>
  );
}

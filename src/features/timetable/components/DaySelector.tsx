import { useRef, type KeyboardEvent } from 'react';
import type { DayId } from '../../../schemas/timetable';
import { cx } from '../../../utils/classNames';
import { DAYS } from '../domain/days';
import styles from './DaySelector.module.css';

interface DaySelectorProps {
  value: DayId;
  onChange: (day: DayId) => void;
}

/** Row of five day letters (א–ה); the selected day sits in a teal circle. */
export function DaySelector({ value, onChange }: DaySelectorProps) {
  const refs = useRef<Array<HTMLButtonElement | null>>([]);

  /** Arrow keys move the selection (RTL: ArrowLeft = next day). */
  const onKeyDown = (event: KeyboardEvent, index: number) => {
    const delta = event.key === 'ArrowLeft' ? 1 : event.key === 'ArrowRight' ? -1 : 0;
    const next = DAYS[index + delta];
    if (!delta || !next) return;
    event.preventDefault();
    refs.current[index + delta]?.focus();
    onChange(next.id);
  };

  return (
    <div className={styles.bar} role="radiogroup" aria-label="בחירת יום">
      {DAYS.map((day, index) => {
        const selected = day.id === value;
        return (
          <button
            key={day.id}
            ref={(el) => {
              refs.current[index] = el;
            }}
            type="button"
            role="radio"
            aria-checked={selected}
            aria-label={`יום ${day.name}`}
            tabIndex={selected ? 0 : -1}
            className={cx(styles.day, selected && styles.selected)}
            onClick={() => onChange(day.id)}
            onKeyDown={(event) => onKeyDown(event, index)}
          >
            <span className={styles.circle}>{day.letter}</span>
          </button>
        );
      })}
    </div>
  );
}

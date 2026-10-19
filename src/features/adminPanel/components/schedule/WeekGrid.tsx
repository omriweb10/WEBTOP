import { useState, type DragEvent } from 'react';
import type { Preset } from '../../../../schemas/presets';
import type { DayId, Timetable } from '../../../../schemas/timetable';
import { cx } from '../../../../utils/classNames';
import { DAYS } from '../../../timetable/domain/days';
import { formatPeriodRange } from '../../../timetable/domain/periods';
import { copyLesson, moveLesson, type Slot } from '../../../timetable/domain/timetableOps';
import { CellSheet } from './CellSheet';
import styles from './schedule.module.css';

interface WeekGridProps {
  timetable: Timetable;
  /** Subjects that may be placed. */
  presets: readonly Preset[];
  onChange: (next: Timetable) => void;
}

const DRAG_TYPE = 'application/x-webtop-slot';

/** Parses "day:index" from a drag payload. */
function parseSlot(value: string): Slot | null {
  const [day, index] = value.split(':');
  if (!DAYS.some((d) => d.id === day) || index === undefined || !/^\d+$/.test(index)) return null;
  return { day: day as DayId, index: Number(index) };
}

/**
 * Editable Sunday–Thursday grid. Tap a cell to choose a subject, empty it, or move/copy it.
 * With a mouse, lessons can also be dragged: drop to move (swapping with an occupied cell),
 * hold Alt/Ctrl/⌘ while dropping to copy.
 */
export function WeekGrid({ timetable, presets, onChange }: WeekGridProps) {
  const [editing, setEditing] = useState<Slot | null>(null);
  const [dropTarget, setDropTarget] = useState<string | null>(null);

  /** Starts dragging a lesson. */
  const onDragStart = (event: DragEvent, slot: Slot) => {
    event.dataTransfer.setData(DRAG_TYPE, `${slot.day}:${slot.index}`);
    event.dataTransfer.setData('text/plain', `${slot.day}:${slot.index}`);
    event.dataTransfer.effectAllowed = 'copyMove';
  };

  /** Accepts a drop and shows copy vs move. */
  const onDragOver = (event: DragEvent, key: string) => {
    if (!event.dataTransfer.types.includes(DRAG_TYPE)) return;
    event.preventDefault();
    event.dataTransfer.dropEffect = event.altKey || event.ctrlKey || event.metaKey ? 'copy' : 'move';
    setDropTarget(key);
  };

  /** Moves or copies the dragged lesson into the target cell. */
  const onDrop = (event: DragEvent, to: Slot) => {
    event.preventDefault();
    setDropTarget(null);
    const from = parseSlot(event.dataTransfer.getData(DRAG_TYPE));
    if (!from) return;
    const copy = event.altKey || event.ctrlKey || event.metaKey;
    onChange(copy ? copyLesson(timetable, from, to) : moveLesson(timetable, from, to, 'swap'));
  };

  return (
    <>
      <div className={styles.gridScroll}>
        <table className={styles.grid}>
          <thead>
            <tr>
              <th scope="col" className={styles.corner}>
                שעה
              </th>
              {DAYS.map((day) => (
                <th key={day.id} scope="col">
                  {day.name}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {timetable.periods.map((period, index) => (
              <tr key={period.number}>
                <th scope="row" className={styles.periodCell}>
                  <span className={styles.periodNumber}>{period.number}</span>
                  <span className={styles.periodTime}>{formatPeriodRange(period)}</span>
                </th>
                {DAYS.map((day) => {
                  const slot = { day: day.id, index };
                  const key = `${day.id}:${index}`;
                  const lesson = timetable.days[day.id][index] ?? null;
                  return (
                    <td
                      key={key}
                      className={cx(styles.cell, dropTarget === key && styles.dropping)}
                      onDragOver={(event) => onDragOver(event, key)}
                      onDragLeave={() => setDropTarget((current) => (current === key ? null : current))}
                      onDrop={(event) => onDrop(event, slot)}
                    >
                      {lesson ? (
                        <button
                          type="button"
                          className={styles.chip}
                          style={{ borderInlineStartColor: lesson.color }}
                          draggable
                          onDragStart={(event) => onDragStart(event, slot)}
                          onClick={() => setEditing(slot)}
                          aria-label={`${day.name}, שעה ${period.number}: ${lesson.subject}. עריכה`}
                        >
                          <span className={styles.chipName}>{lesson.subject}</span>
                          {lesson.teacher && <span className={styles.chipMeta}>{lesson.teacher}</span>}
                        </button>
                      ) : (
                        <button
                          type="button"
                          className={styles.empty}
                          onClick={() => setEditing(slot)}
                          aria-label={`${day.name}, שעה ${period.number}: ריקה. הוספת שיעור`}
                        >
                          +
                        </button>
                      )}
                    </td>
                  );
                })}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      {editing && (
        <CellSheet
          key={`${editing.day}:${editing.index}`}
          timetable={timetable}
          slot={editing}
          presets={presets}
          onChange={onChange}
          onClose={() => setEditing(null)}
        />
      )}
    </>
  );
}

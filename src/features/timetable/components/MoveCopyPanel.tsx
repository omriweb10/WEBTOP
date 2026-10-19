import { useState } from 'react';
import { Button } from '../../../components/ui/Button';
import { SelectField } from '../../../components/ui/fields';
import type { DayId, Timetable } from '../../../schemas/timetable';
import { DAYS, getDayInfo } from '../domain/days';
import { formatPeriodLabel } from '../domain/periods';
import { getLesson, sameSlot, type ConflictMode, type Slot } from '../domain/timetableOps';
import { timetableActions } from '../timetableActions';
import styles from './LessonEditor.module.css';

interface MoveCopyPanelProps {
  timetable: Timetable;
  from: Slot;
  onDone: () => void;
}

type Mode = 'move' | 'copy';

/** Touch-friendly alternative to drag-and-drop: pick a target day/period and move or copy. */
export function MoveCopyPanel({ timetable, from, onDone }: MoveCopyPanelProps) {
  const [mode, setMode] = useState<Mode>('move');
  const [day, setDay] = useState<DayId>(from.day);
  const [index, setIndex] = useState(String(Math.min(from.index + 1, timetable.periods.length - 1)));
  const [conflict, setConflict] = useState<ConflictMode>('swap');

  const target: Slot = { day, index: Number(index) };
  const occupant = getLesson(timetable, target);
  const isSame = sameSlot(from, target);

  /** Runs the chosen operation through the undoable timetable actions. */
  const apply = () => {
    if (isSame) return;
    if (mode === 'move') timetableActions.move(from, target, conflict);
    else timetableActions.copy(from, target);
    onDone();
  };

  return (
    <section className={styles.subpanel} aria-label="העברה או העתקה">
      <div className={styles.segmented} role="radiogroup" aria-label="סוג פעולה">
        {(['move', 'copy'] as const).map((value) => (
          <button
            key={value}
            type="button"
            role="radio"
            aria-checked={mode === value}
            className={mode === value ? styles.segmentOn : styles.segment}
            onClick={() => setMode(value)}
          >
            {value === 'move' ? 'העברה' : 'העתקה'}
          </button>
        ))}
      </div>
      <div className={styles.row}>
        <SelectField
          label="יום יעד"
          value={day}
          options={DAYS.map((d) => ({ value: d.id, label: d.name }))}
          onValueChange={setDay}
        />
        <SelectField
          label="שעה"
          value={index}
          options={timetable.periods.map((p, i) => ({ value: String(i), label: formatPeriodLabel(p) }))}
          onValueChange={setIndex}
        />
      </div>
      {isSame ? (
        <p className={styles.note}>זו אותה שעה — יש לבחור יעד אחר.</p>
      ) : occupant ? (
        <>
          <p className={styles.note}>
            ב{getDayInfo(day).name}, שעה {target.index + 1} כבר קיים השיעור „{occupant.subject}”.
            {mode === 'copy' && ' ההעתקה תחליף אותו.'}
          </p>
          {mode === 'move' && (
            <SelectField
              label="מה לעשות עם השיעור הקיים?"
              value={conflict}
              options={[
                { value: 'swap', label: 'להחליף ביניהם (השיעור הקיים יעבור לכאן)' },
                { value: 'replace', label: 'לדרוס אותו' },
              ]}
              onValueChange={setConflict}
            />
          )}
        </>
      ) : (
        <p className={styles.note}>השעה שנבחרה פנויה.</p>
      )}
      <Button variant="primary" block disabled={isSame} onClick={apply}>
        {mode === 'move' ? 'העברה' : 'העתקה'} לשעה שנבחרה
      </Button>
    </section>
  );
}

import { useState } from 'react';
import { Button } from '../../../components/ui/Button';
import { confirm } from '../../../components/ui/confirmStore';
import type { Lesson, Timetable } from '../../../schemas/timetable';
import { getLesson, nextSlot, type Slot } from '../domain/timetableOps';
import { timetableActions } from '../timetableActions';
import { MoveCopyPanel } from './MoveCopyPanel';
import styles from './LessonEditor.module.css';

interface SavedLessonActionsProps {
  timetable: Timetable;
  slot: Slot;
  saved: Lesson;
  onDone: () => void;
}

/** Duplicate / move / copy / delete for the lesson already saved in a cell. */
export function SavedLessonActions({ timetable, slot, saved, onDone }: SavedLessonActionsProps) {
  const [moving, setMoving] = useState(false);
  const hasNext = nextSlot(timetable, slot) !== null;

  /** Deletes the saved lesson after confirmation, leaving an empty period. */
  const remove = async () => {
    const ok = await confirm({
      title: 'מחיקת שיעור',
      message: `למחוק את „${saved.subject}” ולהשאיר את השעה ריקה?`,
      confirmLabel: 'מחיקה',
      tone: 'danger',
    });
    if (!ok) return;
    timetableActions.clear(slot);
    onDone();
  };

  /** Copies the saved lesson into the next period (asks before overwriting). */
  const duplicate = async () => {
    const target = nextSlot(timetable, slot);
    if (!target) return;
    const occupant = getLesson(timetable, target);
    if (occupant) {
      const ok = await confirm({
        title: 'שכפול לשעה הבאה',
        message: `בשעה ${target.index + 1} קיים „${occupant.subject}”. להחליף אותו בעותק של „${saved.subject}”?`,
        confirmLabel: 'החלפה',
      });
      if (!ok) return;
    }
    timetableActions.duplicateToNext(slot);
    onDone();
  };

  return (
    <>
      <h3 className={styles.heading}>פעולות על השיעור השמור</h3>
      <div className={styles.actionsGrid}>
        <Button icon="libraryAdd" onClick={() => void duplicate()} disabled={!hasNext}>
          שכפול לשעה הבאה
        </Button>
        <Button icon="move" onClick={() => setMoving((v) => !v)} aria-expanded={moving}>
          העברה / העתקה…
        </Button>
        <Button icon="delete" variant="danger" onClick={() => void remove()}>
          מחיקה (שעה ריקה)
        </Button>
      </div>
      {moving && <MoveCopyPanel timetable={timetable} from={slot} onDone={onDone} />}
    </>
  );
}

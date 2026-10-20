import { useRef, useState } from 'react';
import { ScrollTopButton } from '../../../components/ui/ScrollTopButton';
import { accountMode } from '../../../config/backend';
import { useTimetableStore } from '../../../store/dataStores';
import { cx } from '../../../utils/classNames';
import { useIsEditing } from '../../admin/editModeStore';
import type { Slot } from '../domain/timetableOps';
import { useScrolledPast } from '../hooks/useScrolledPast';
import { useTimetableViewStore } from '../timetableViewStore';
import { AssignedLessonEditor } from './AssignedLessonEditor';
import { ChangeAlert } from './ChangeAlert';
import { DaySelector } from './DaySelector';
import { LessonEditor } from './LessonEditor';
import { TimetableTable } from './TimetableTable';
import styles from './DayTimetableView.module.css';

interface DayTimetableViewProps {
  /** Leaves the measured gap between the day bar and the table (Student Card screen). */
  spacedTable?: boolean;
}

/**
 * The day view shared by every timetable screen: gap, day selector, the scrollable day
 * table, the scroll-to-top button and, in edit mode, the lesson editor. It reads and edits
 * the one timetable store, so every screen shows (and saves) the same timetable. The day
 * changes only by tapping the day buttons; the table has no gestures besides native
 * vertical scrolling.
 */
export function DayTimetableView({ spacedTable = false }: DayTimetableViewProps) {
  const timetable = useTimetableStore((state) => state.value);
  const day = useTimetableViewStore((state) => state.day);
  const direction = useTimetableViewStore((state) => state.direction);
  const selectDay = useTimetableViewStore((state) => state.selectDay);
  const editing = useIsEditing();
  const [editSlot, setEditSlot] = useState<Slot | null>(null);

  const scrollRef = useRef<HTMLDivElement>(null);
  const scrolled = useScrolledPast(scrollRef);

  return (
    <>
      <div className={styles.gap} />
      <DaySelector value={day} onChange={selectDay} />
      <div ref={scrollRef} className={styles.scroll} data-testid="timetable-scroll">
        <ChangeAlert day={day} />
        <div className={cx(styles.tableWrap, spacedTable && styles.spaced)}>
          <TimetableTable
            key={day}
            timetable={timetable}
            day={day}
            direction={direction}
            onEditSlot={editing ? setEditSlot : undefined}
          />
        </div>
      </div>
      <ScrollTopButton visible={scrolled} onClick={() => scrollRef.current?.scrollTo({ top: 0, behavior: 'smooth' })} />
      {editing &&
        editSlot &&
        (accountMode ? (
          <AssignedLessonEditor key={`${editSlot.day}-${editSlot.index}`} slot={editSlot} onClose={() => setEditSlot(null)} />
        ) : (
          <LessonEditor key={`${editSlot.day}-${editSlot.index}`} slot={editSlot} onClose={() => setEditSlot(null)} />
        ))}
    </>
  );
}

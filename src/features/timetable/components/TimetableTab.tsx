import { useCallback, useRef, useState } from 'react';
import { ScrollTopButton } from '../../../components/ui/ScrollTopButton';
import { UnderlineSelect } from '../../../components/ui/UnderlineSelect';
import { useProfileStore, useTimetableStore } from '../../../store/dataStores';
import { useIsEditing } from '../../admin/editModeStore';
import { adjacentDay } from '../domain/days';
import type { Slot } from '../domain/timetableOps';
import { useScrolledPast } from '../hooks/useScrolledPast';
import { useSwipeNavigation } from '../hooks/useSwipeNavigation';
import { useTimetableViewStore } from '../timetableViewStore';
import { ChangeAlert } from './ChangeAlert';
import { DaySelector } from './DaySelector';
import { LessonEditor } from './LessonEditor';
import { TimetableTable } from './TimetableTable';
import styles from './TimetableTab.module.css';

/**
 * "מערכת שעות" tab: display selector, day selector and the scrollable day table.
 * Horizontal swipes change the day (RTL: swiping right reveals the next day).
 */
export function TimetableTab() {
  const timetable = useTimetableStore((state) => state.value);
  const className = useProfileStore((state) => state.value.className);
  const day = useTimetableViewStore((state) => state.day);
  const direction = useTimetableViewStore((state) => state.direction);
  const selectDay = useTimetableViewStore((state) => state.selectDay);
  const editing = useIsEditing();
  const [editSlot, setEditSlot] = useState<Slot | null>(null);

  const scrollRef = useRef<HTMLDivElement>(null);
  const feedbackRef = useRef<HTMLDivElement>(null);
  const scrolled = useScrolledPast(scrollRef);

  const nextDay = useCallback(() => {
    const next = adjacentDay(day, 1);
    if (next) selectDay(next);
  }, [day, selectDay]);
  const previousDay = useCallback(() => {
    const previous = adjacentDay(day, -1);
    if (previous) selectDay(previous);
  }, [day, selectDay]);

  useSwipeNavigation(scrollRef, { onSwipeRight: nextDay, onSwipeLeft: previousDay, feedbackRef });

  return (
    <>
      <UnderlineSelect label="תצוגה" value="class" options={[{ value: 'class', label: className }]} onChange={() => undefined} />
      <div className={styles.gap} />
      <DaySelector value={day} onChange={selectDay} />
      <div ref={scrollRef} className={styles.scroll} data-testid="timetable-scroll">
        <ChangeAlert day={day} />
        <div ref={feedbackRef} className={styles.tableWrap}>
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
      {editing && editSlot && (
        <LessonEditor key={`${editSlot.day}-${editSlot.index}`} slot={editSlot} onClose={() => setEditSlot(null)} />
      )}
    </>
  );
}

/**
 * Pure timetable operations. Every function returns a new Timetable and never mutates
 * its input, so stores can keep history/undo snapshots cheaply and tests stay simple.
 */
import { DAY_IDS, type DayId, type Lesson, type Period, type Timetable } from '../../../schemas/timetable';
import { createId } from '../../../utils/id';

/** Address of one cell in the weekly grid. */
export interface Slot {
  day: DayId;
  index: number;
}

export type ConflictMode = 'replace' | 'swap';

/** Builds a timetable where every period of every day is empty. */
export function createEmptyTimetable(periods: readonly Period[]): Timetable {
  const column = () => periods.map(() => null);
  return {
    periods: periods.map((p) => ({ ...p })),
    days: { sun: column(), mon: column(), tue: column(), wed: column(), thu: column() },
  };
}

/** True when the slot points inside the grid. */
export function isValidSlot(timetable: Timetable, slot: Slot): boolean {
  return Number.isInteger(slot.index) && slot.index >= 0 && slot.index < timetable.periods.length;
}

/** Reads the lesson at a slot (null = empty period). */
export function getLesson(timetable: Timetable, slot: Slot): Lesson | null {
  return timetable.days[slot.day][slot.index] ?? null;
}

/** Returns the lesson cells of a day paired with their periods, preserving empty periods. */
export function getDayRows(
  timetable: Timetable,
  day: DayId,
): Array<{ period: Period; index: number; lesson: Lesson | null }> {
  return timetable.periods.map((period, index) => ({
    period,
    index,
    lesson: timetable.days[day][index] ?? null,
  }));
}

/** Writes a lesson (or null to empty the period) into one slot. */
export function setLesson(timetable: Timetable, slot: Slot, lesson: Lesson | null): Timetable {
  if (!isValidSlot(timetable, slot)) throw new RangeError(`Invalid slot ${slot.day}:${slot.index}`);
  const column = [...timetable.days[slot.day]];
  column[slot.index] = lesson ? { ...lesson } : null;
  return { ...timetable, days: { ...timetable.days, [slot.day]: column } };
}

/** Empties a slot; a no-op when it is already empty. */
export function clearSlot(timetable: Timetable, slot: Slot): Timetable {
  return getLesson(timetable, slot) ? setLesson(timetable, slot, null) : timetable;
}

/** True if two slots address the same cell. */
export function sameSlot(a: Slot, b: Slot): boolean {
  return a.day === b.day && a.index === b.index;
}

/**
 * Moves a lesson to another slot. If the target is occupied, `replace` overwrites it and
 * `swap` exchanges the two lessons. Moving an empty slot or onto itself changes nothing.
 */
export function moveLesson(
  timetable: Timetable,
  from: Slot,
  to: Slot,
  mode: ConflictMode = 'replace',
): Timetable {
  const source = getLesson(timetable, from);
  if (!source || sameSlot(from, to)) return timetable;
  const target = getLesson(timetable, to);
  const withTarget = setLesson(timetable, to, source);
  return setLesson(withTarget, from, mode === 'swap' ? target : null);
}

/** Copies a lesson into another slot under a fresh id (overwriting the target). */
export function copyLesson(timetable: Timetable, from: Slot, to: Slot): Timetable {
  const source = getLesson(timetable, from);
  if (!source || sameSlot(from, to)) return timetable;
  return setLesson(timetable, to, { ...source, id: createId('lsn') });
}

/** Next period on the same day, or null when `slot` is the last period. */
export function nextSlot(timetable: Timetable, slot: Slot): Slot | null {
  const index = slot.index + 1;
  return index < timetable.periods.length ? { day: slot.day, index } : null;
}

/** Duplicates a lesson into the following period of the same day (the common "double lesson"). */
export function duplicateToNextPeriod(timetable: Timetable, slot: Slot): Timetable {
  const target = nextSlot(timetable, slot);
  return target ? copyLesson(timetable, slot, target) : timetable;
}

/** Applies `fn` to every lesson (empty periods are skipped) and returns the updated grid. */
export function mapLessons(timetable: Timetable, fn: (lesson: Lesson, slot: Slot) => Lesson | null): Timetable {
  const days = { ...timetable.days };
  for (const day of DAY_IDS) {
    days[day] = timetable.days[day].map((lesson, index) => (lesson ? fn(lesson, { day, index }) : null));
  }
  return { ...timetable, days };
}

/** Lists the slots of every lesson matching a predicate. */
export function findLessonSlots(timetable: Timetable, predicate: (lesson: Lesson) => boolean): Slot[] {
  const slots: Slot[] = [];
  for (const day of DAY_IDS) {
    timetable.days[day].forEach((lesson, index) => {
      if (lesson && predicate(lesson)) slots.push({ day, index });
    });
  }
  return slots;
}

/** Counts non-empty periods in the week. */
export function countLessons(timetable: Timetable): number {
  return findLessonSlots(timetable, () => true).length;
}

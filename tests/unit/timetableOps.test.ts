import { describe, expect, it } from 'vitest';
import { DEFAULT_PERIODS } from '../../src/data/periods';
import { createExampleTimetable } from '../../src/data/exampleTimetable';
import {
  clearSlot,
  copyLesson,
  countLessons,
  createEmptyTimetable,
  duplicateToNextPeriod,
  getDayRows,
  getLesson,
  moveLesson,
  setLesson,
} from '../../src/features/timetable/domain/timetableOps';
import { TimetableSchema, type Lesson } from '../../src/schemas/timetable';

const lesson = (id: string, subject = 'מתמטיקה'): Lesson => ({
  id,
  presetId: null,
  subject,
  teacher: 'מורה',
  room: '1',
  color: '#1498fd',
});

describe('timetable operations', () => {
  it('creates 13 empty periods for each of the five days', () => {
    const tt = createEmptyTimetable(DEFAULT_PERIODS);
    expect(tt.periods).toHaveLength(13);
    expect(Object.values(tt.days).every((col) => col.length === 13 && col.every((c) => c === null))).toBe(true);
    expect(TimetableSchema.safeParse(tt).success).toBe(true);
  });

  it('keeps empty periods as rows when listing a day', () => {
    const tt = setLesson(createEmptyTimetable(DEFAULT_PERIODS), { day: 'tue', index: 1 }, lesson('a'));
    const rows = getDayRows(tt, 'tue');
    expect(rows).toHaveLength(13);
    expect(rows[0]?.lesson).toBeNull();
    expect(rows[1]?.lesson?.id).toBe('a');
  });

  it('sets and clears a lesson without mutating the input', () => {
    const empty = createEmptyTimetable(DEFAULT_PERIODS);
    const withLesson = setLesson(empty, { day: 'sun', index: 0 }, lesson('a'));
    expect(getLesson(empty, { day: 'sun', index: 0 })).toBeNull();
    expect(getLesson(withLesson, { day: 'sun', index: 0 })?.id).toBe('a');
    const cleared = clearSlot(withLesson, { day: 'sun', index: 0 });
    expect(getLesson(cleared, { day: 'sun', index: 0 })).toBeNull();
    expect(getLesson(withLesson, { day: 'sun', index: 0 })?.id).toBe('a');
  });

  it('rejects slots outside the grid', () => {
    expect(() => setLesson(createEmptyTimetable(DEFAULT_PERIODS), { day: 'sun', index: 13 }, lesson('x'))).toThrow(RangeError);
  });

  it('moves a lesson into an empty slot', () => {
    let tt = setLesson(createEmptyTimetable(DEFAULT_PERIODS), { day: 'sun', index: 0 }, lesson('a'));
    tt = moveLesson(tt, { day: 'sun', index: 0 }, { day: 'thu', index: 5 });
    expect(getLesson(tt, { day: 'sun', index: 0 })).toBeNull();
    expect(getLesson(tt, { day: 'thu', index: 5 })?.id).toBe('a');
  });

  it('replaces or swaps when the move target is occupied', () => {
    let tt = createEmptyTimetable(DEFAULT_PERIODS);
    tt = setLesson(tt, { day: 'sun', index: 0 }, lesson('a', 'א'));
    tt = setLesson(tt, { day: 'mon', index: 0 }, lesson('b', 'ב'));
    const replaced = moveLesson(tt, { day: 'sun', index: 0 }, { day: 'mon', index: 0 }, 'replace');
    expect(getLesson(replaced, { day: 'mon', index: 0 })?.id).toBe('a');
    expect(getLesson(replaced, { day: 'sun', index: 0 })).toBeNull();
    const swapped = moveLesson(tt, { day: 'sun', index: 0 }, { day: 'mon', index: 0 }, 'swap');
    expect(getLesson(swapped, { day: 'mon', index: 0 })?.id).toBe('a');
    expect(getLesson(swapped, { day: 'sun', index: 0 })?.id).toBe('b');
  });

  it('copies with a new id so the timetable stays valid', () => {
    let tt = setLesson(createEmptyTimetable(DEFAULT_PERIODS), { day: 'wed', index: 2 }, lesson('a'));
    tt = copyLesson(tt, { day: 'wed', index: 2 }, { day: 'thu', index: 2 });
    const copy = getLesson(tt, { day: 'thu', index: 2 });
    expect(copy?.subject).toBe('מתמטיקה');
    expect(copy?.id).not.toBe('a');
    expect(TimetableSchema.safeParse(tt).success).toBe(true);
  });

  it('duplicates into the next period and ignores the last period', () => {
    let tt = setLesson(createEmptyTimetable(DEFAULT_PERIODS), { day: 'sun', index: 3 }, lesson('a'));
    tt = duplicateToNextPeriod(tt, { day: 'sun', index: 3 });
    expect(getLesson(tt, { day: 'sun', index: 4 })?.subject).toBe('מתמטיקה');
    const last = setLesson(tt, { day: 'sun', index: 12 }, lesson('z'));
    expect(duplicateToNextPeriod(last, { day: 'sun', index: 12 })).toBe(last);
  });

  it('treats moving an empty slot or onto itself as a no-op', () => {
    const tt = createExampleTimetable();
    expect(moveLesson(tt, { day: 'sun', index: 12 }, { day: 'mon', index: 0 })).toBe(tt);
    expect(moveLesson(tt, { day: 'sun', index: 0 }, { day: 'sun', index: 0 })).toBe(tt);
  });

  it('ships a valid example timetable', () => {
    const tt = createExampleTimetable();
    expect(TimetableSchema.safeParse(tt).success).toBe(true);
    expect(countLessons(tt)).toBeGreaterThan(20);
  });
});

/** School-week day metadata and date→day rules (Sunday–Thursday). */
import { DAY_IDS, type DayId } from '../../../schemas/timetable';

export interface DayInfo {
  id: DayId;
  /** Single Hebrew letter used in the day selector. */
  letter: string;
  /** Full day name used in the table header. */
  name: string;
  /** JavaScript Date#getDay() value. */
  weekday: number;
}

export const DAYS: readonly DayInfo[] = [
  { id: 'sun', letter: 'א', name: 'ראשון', weekday: 0 },
  { id: 'mon', letter: 'ב', name: 'שני', weekday: 1 },
  { id: 'tue', letter: 'ג', name: 'שלישי', weekday: 2 },
  { id: 'wed', letter: 'ד', name: 'רביעי', weekday: 3 },
  { id: 'thu', letter: 'ה', name: 'חמישי', weekday: 4 },
];

/** Looks up a day's display metadata. */
export function getDayInfo(day: DayId): DayInfo {
  const info = DAYS.find((d) => d.id === day);
  if (!info) throw new Error(`Unknown day ${day}`);
  return info;
}

/** Maps a date to its school day, or null on Friday/Saturday. */
export function dayIdForDate(date: Date): DayId | null {
  return DAYS.find((d) => d.weekday === date.getDay())?.id ?? null;
}

/** Day the timetable opens on: today if it is a school day, otherwise Sunday. */
export function defaultDayForDate(date: Date): DayId {
  return dayIdForDate(date) ?? 'sun';
}

/** Returns the neighbouring school day (no wrap-around), or null at either end of the week. */
export function adjacentDay(day: DayId, step: 1 | -1): DayId | null {
  const index = DAY_IDS.indexOf(day) + step;
  return DAY_IDS[index] ?? null;
}

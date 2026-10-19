/**
 * Default bell schedule: 13 periods, Sunday–Thursday, read from the reference recording.
 * Editable at runtime through import; validated by TimetableSchema.
 */
import type { Period } from '../schemas/timetable';

export const DEFAULT_PERIODS: readonly Period[] = [
  { number: 1, start: '8:00', end: '8:50' },
  { number: 2, start: '8:55', end: '9:40' },
  { number: 3, start: '9:50', end: '10:35' },
  { number: 4, start: '10:55', end: '11:40' },
  { number: 5, start: '11:50', end: '12:35' },
  { number: 6, start: '12:45', end: '13:30' },
  { number: 7, start: '13:40', end: '14:25' },
  { number: 8, start: '14:25', end: '15:10' },
  { number: 9, start: '15:15', end: '16:00' },
  { number: 10, start: '16:00', end: '16:45' },
  { number: 11, start: '16:45', end: '17:30' },
  { number: 12, start: '17:40', end: '18:25' },
  { number: 13, start: '18:25', end: '19:10' },
];

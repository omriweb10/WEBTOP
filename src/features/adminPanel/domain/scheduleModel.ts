/**
 * Converts between server lesson rows and the app's Timetable model, so the admin's
 * schedule editors reuse the same pure timetable operations as the student app.
 */
import type { Preset } from '../../../schemas/presets';
import { DAY_IDS, type Period, type Timetable } from '../../../schemas/timetable';
import { buildTimetable } from '../../account/domain/bundle';
import { createEmptyTimetable } from '../../timetable/domain/timetableOps';
import type { LessonRow, PresetRow } from '../api/types';

export const MAX_PERIODS = 13;

/** Server preset row → local preset (archived ones still render where they are placed). */
export function presetRowToLocal(row: PresetRow): Preset {
  return {
    id: row.id,
    name: (row.short_name.trim() || row.name).slice(0, 40),
    subject: row.name,
    teacher: row.teacher,
    room: row.room,
    color: row.color.toLowerCase(),
  };
}

/** Lookup map for building timetables. */
export function presetMap(rows: readonly PresetRow[]): Map<string, Preset> {
  return new Map(rows.map((row) => [row.id, presetRowToLocal(row)]));
}

/** Timetable for an editor from periods and lesson rows. */
export function timetableFromRows(periods: readonly Period[], lessons: readonly LessonRow[], presets: ReadonlyMap<string, Preset>): Timetable {
  return buildTimetable([...periods], lessons, presets);
}

/** Every placed lesson as a row (for saving a template). */
export function rowsFromTimetable(timetable: Timetable): LessonRow[] {
  const rows: LessonRow[] = [];
  for (const day of DAY_IDS) {
    timetable.days[day].forEach((lesson, index) => {
      if (lesson?.presetId) rows.push({ day, period_index: index, preset_id: lesson.presetId });
    });
  }
  return rows;
}

/** Re-fits a timetable to a new period list, dropping lessons beyond the last period. */
export function withPeriods(timetable: Timetable, periods: readonly Period[]): Timetable {
  const resized = createEmptyTimetable(periods);
  for (const day of DAY_IDS) {
    resized.days[day] = periods.map((_, index) => timetable.days[day][index] ?? null);
  }
  return resized;
}

/** Number of lessons that a shorter period list would remove. */
export function lessonsLostByResize(timetable: Timetable, periodCount: number): number {
  let lost = 0;
  for (const day of DAY_IDS) timetable.days[day].forEach((lesson, index) => {
    if (lesson && index >= periodCount) lost += 1;
  });
  return lost;
}

/** Renumbers periods 1..n after adding or removing one. */
export function renumber(periods: readonly Period[]): Period[] {
  return periods.map((period, index) => ({ ...period, number: index + 1 }));
}

/** Adds a period after the last one, 45 minutes long, starting 5 minutes after it ends. */
export function appendPeriod(periods: readonly Period[]): Period[] {
  if (periods.length >= MAX_PERIODS) return [...periods];
  const last = periods[periods.length - 1];
  const toMinutes = (t: string) => {
    const [h, m] = t.split(':').map(Number);
    return (h ?? 0) * 60 + (m ?? 0);
  };
  const fromMinutes = (total: number) => `${Math.floor(total / 60) % 24}:${String(total % 60).padStart(2, '0')}`;
  const start = last ? Math.min(toMinutes(last.end) + 5, 23 * 60) : 8 * 60;
  const end = Math.min(start + 45, 23 * 60 + 59);
  return renumber([...periods, { number: periods.length + 1, start: fromMinutes(start), end: fromMinutes(end) }]);
}

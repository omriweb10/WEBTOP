/** Period (lesson hour) rules and labels. */
import type { Period } from '../../../schemas/timetable';
import { normalizeTime, timeToMinutes } from '../../../utils/time';

/**
 * Separator between start and end times: U+2010 HYPHEN. It looks like "-" but is
 * bidi-neutral, so in RTL text the start time stays on the right ("8:50-8:00 .1"
 * visually), exactly like the reference. An ASCII "-" would glue both times into one
 * left-to-right number run.
 */
export const TIME_RANGE_SEPARATOR = '\u2010';

/** Human label in the reference format, e.g. "1. 8:00‐8:50" (rendered RTL). */
export function formatPeriodLabel(period: Period): string {
  return `${period.number}. ${formatPeriodRange(period)}`;
}

/** Time range only, e.g. "8:00‐8:50". */
export function formatPeriodRange(period: Period): string {
  return `${normalizeTime(period.start)}${TIME_RANGE_SEPARATOR}${normalizeTime(period.end)}`;
}

/** Returns validation messages for a period list (order, overlaps, start<end); empty = valid. */
export function validatePeriods(periods: readonly Period[]): string[] {
  const errors: string[] = [];
  periods.forEach((period, index) => {
    const start = timeToMinutes(period.start);
    const end = timeToMinutes(period.end);
    if (!(start < end)) errors.push(`שעה ${period.number}: שעת הסיום חייבת להיות אחרי שעת ההתחלה`);
    const previous = periods[index - 1];
    if (previous && timeToMinutes(previous.end) > start) {
      errors.push(`שעה ${period.number} מתחילה לפני סיום שעה ${previous.number}`);
    }
  });
  return errors;
}

/** Index of the period running at `minutes` since midnight, or -1 if none. */
export function currentPeriodIndex(periods: readonly Period[], minutes: number): number {
  return periods.findIndex(
    (period) => timeToMinutes(period.start) <= minutes && minutes < timeToMinutes(period.end),
  );
}

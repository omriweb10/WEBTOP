/** Maps template days to concrete calendar dates for "this school week". */
import type { DayId } from '../../../schemas/timetable';
import { addDays, startOfWeek, toIsoDate } from '../../../utils/dates';
import { getDayInfo } from './days';

/**
 * The school week shown by the timetable: the current Sunday–Thursday, or the next one
 * on Friday/Saturday (when the coming week is what students care about).
 */
export function displayedWeekStart(today: Date): Date {
  const start = startOfWeek(today);
  return today.getDay() >= 5 ? addDays(start, 7) : start;
}

/** ISO date of a template day within the displayed school week. */
export function isoDateForDay(day: DayId, today: Date): string {
  return toIsoDate(addDays(displayedWeekStart(today), getDayInfo(day).weekday));
}

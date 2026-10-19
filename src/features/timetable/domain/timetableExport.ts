/** Converts the weekly timetable into calendar events (one weekly-recurring event per lesson). */
import type { Timetable } from '../../../schemas/timetable';
import type { IcsEvent } from '../../../services/calendar/ics';
import { addDays, startOfWeek } from '../../../utils/dates';
import { timeToMinutes } from '../../../utils/time';
import { DAYS } from './days';

/** Returns a copy of `day` with the clock set from a "H:MM" string. */
function atTime(day: Date, time: string): Date {
  const minutes = timeToMinutes(time);
  const result = new Date(day);
  result.setHours(Math.floor(minutes / 60), minutes % 60, 0, 0);
  return result;
}

/**
 * Builds weekly-recurring events for every lesson, anchored to the school week that
 * contains `referenceDate`. Empty periods produce no events.
 */
export function timetableToIcsEvents(timetable: Timetable, referenceDate: Date): IcsEvent[] {
  const weekStart = startOfWeek(referenceDate);
  const events: IcsEvent[] = [];
  for (const day of DAYS) {
    const date = addDays(weekStart, day.weekday);
    timetable.days[day.id].forEach((lesson, index) => {
      const period = timetable.periods[index];
      if (!lesson || !period) return;
      events.push({
        uid: `${lesson.id}-${day.id}-${index}@webtop-pwa.local`,
        summary: lesson.subject,
        location: lesson.room || undefined,
        description: lesson.teacher || undefined,
        start: atTime(date, period.start),
        end: atTime(date, period.end),
        rrule: 'FREQ=WEEKLY',
      });
    });
  }
  return events;
}

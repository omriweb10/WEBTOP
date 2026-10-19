/** Pure rules for local events and exams: sorting, filtering, grouping, calendar export. */
import type { EventKind, SchoolEvent } from '../../../schemas/content';
import type { IcsEvent } from '../../../services/calendar/ics';
import { addDays, fromIsoDate } from '../../../utils/dates';
import { timeToMinutes } from '../../../utils/time';

export type EventKindFilter = EventKind | 'all';

export const EVENT_KIND_LABELS: Record<EventKind, string> = {
  exam: 'מבחן',
  event: 'אירוע',
};

/** Chronological order: by date, then timed items by time, all-day items first. */
export function sortEvents(events: readonly SchoolEvent[]): SchoolEvent[] {
  return [...events].sort((a, b) => {
    if (a.date !== b.date) return a.date < b.date ? -1 : 1;
    const at = a.time ? timeToMinutes(a.time) : -1;
    const bt = b.time ? timeToMinutes(b.time) : -1;
    return at - bt;
  });
}

/** Applies the kind filter and the class/study-group filter ('' = all groups). */
export function filterEvents(
  events: readonly SchoolEvent[],
  kind: EventKindFilter,
  group: string,
): SchoolEvent[] {
  return events.filter((e) => (kind === 'all' || e.kind === kind) && (group === '' || e.group === group));
}

/** Items on or after `todayIso`, sorted chronologically. */
export function upcomingEvents(events: readonly SchoolEvent[], todayIso: string): SchoolEvent[] {
  return sortEvents(events.filter((e) => e.date >= todayIso));
}

/** Groups sorted events by "YYYY-MM" month key, preserving order. */
export function groupEventsByMonth(events: readonly SchoolEvent[]): Array<{ month: string; events: SchoolEvent[] }> {
  const groups: Array<{ month: string; events: SchoolEvent[] }> = [];
  for (const event of sortEvents(events)) {
    const month = event.date.slice(0, 7);
    const last = groups[groups.length - 1];
    if (last && last.month === month) last.events.push(event);
    else groups.push({ month, events: [event] });
  }
  return groups;
}

/** Distinct, non-empty group names used by events (for the group filter). */
export function eventGroups(events: readonly SchoolEvent[]): string[] {
  return [...new Set(events.map((e) => e.group).filter(Boolean))].sort((a, b) => a.localeCompare(b, 'he'));
}

/** Inserts or replaces an event by id. */
export function upsertEvent(events: readonly SchoolEvent[], event: SchoolEvent): SchoolEvent[] {
  const exists = events.some((e) => e.id === event.id);
  return exists ? events.map((e) => (e.id === event.id ? event : e)) : [...events, event];
}

/** Removes an event by id. */
export function removeEvent(events: readonly SchoolEvent[], id: string): SchoolEvent[] {
  return events.filter((e) => e.id !== id);
}

/** Builds the 6×7 grid of dates (Sunday-first) covering the month that contains `month`. */
export function monthGrid(month: Date): Date[] {
  const first = new Date(month.getFullYear(), month.getMonth(), 1);
  const start = addDays(first, -first.getDay());
  return Array.from({ length: 42 }, (_, i) => addDays(start, i));
}

/** Converts events into calendar entries (timed items last one hour; others are all-day). */
export function eventsToIcsEvents(events: readonly SchoolEvent[]): IcsEvent[] {
  return sortEvents(events).map((event) => {
    const day = fromIsoDate(event.date);
    const summary = `${EVENT_KIND_LABELS[event.kind]}: ${event.title}`;
    if (!event.time) {
      return { uid: `${event.id}@webtop-pwa.local`, summary, description: event.notes || undefined, start: day, end: addDays(day, 1), allDay: true };
    }
    const minutes = timeToMinutes(event.time);
    const start = new Date(day);
    start.setHours(Math.floor(minutes / 60), minutes % 60, 0, 0);
    const end = new Date(start.getTime() + 60 * 60 * 1000);
    return { uid: `${event.id}@webtop-pwa.local`, summary, description: event.notes || undefined, start, end };
  });
}

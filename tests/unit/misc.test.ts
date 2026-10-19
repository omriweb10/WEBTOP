import { describe, expect, it } from 'vitest';
import { isEditCodeValid } from '../../src/features/admin/domain/editCode';
import { EMPTY_TAP_SEQUENCE, registerTap } from '../../src/features/admin/domain/tapUnlock';
import {
  eventsToIcsEvents,
  filterEvents,
  groupEventsByMonth,
  monthGrid,
  sortEvents,
  upcomingEvents,
} from '../../src/features/events/domain/eventOps';
import { greetingLine } from '../../src/features/home/domain/greeting';
import { changesForDate, sortNotices } from '../../src/features/notices/domain/noticeOps';
import { adjacentDay, dayIdForDate, defaultDayForDate } from '../../src/features/timetable/domain/days';
import { currentPeriodIndex, formatPeriodLabel, validatePeriods } from '../../src/features/timetable/domain/periods';
import { timetableToIcsEvents } from '../../src/features/timetable/domain/timetableExport';
import { DEFAULT_PERIODS } from '../../src/data/periods';
import { createExampleTimetable } from '../../src/data/exampleTimetable';
import type { Notice, SchoolEvent } from '../../src/schemas/content';
import { buildIcsCalendar, escapeIcsText, foldIcsLine } from '../../src/services/calendar/ics';
import { formatHebrewDate, toHebrewNumeral } from '../../src/utils/hebrewDate';

describe('seven-tap unlock gesture', () => {
  it('triggers on the seventh rapid tap', () => {
    let seq = EMPTY_TAP_SEQUENCE;
    let triggered = false;
    for (let i = 0; i < 7; i += 1) ({ sequence: seq, triggered } = registerTap(seq, 1000 + i * 200));
    expect(triggered).toBe(true);
    expect(seq.count).toBe(0);
  });

  it('restarts after a slow tap', () => {
    let seq = EMPTY_TAP_SEQUENCE;
    for (let i = 0; i < 6; i += 1) seq = registerTap(seq, i * 200).sequence;
    const slow = registerTap(seq, 6 * 200 + 2000);
    expect(slow.triggered).toBe(false);
    expect(slow.sequence.count).toBe(1);
  });

  it('accepts only the demonstration code', () => {
    expect(isEditCodeValid('581026')).toBe(true);
    expect(isEditCodeValid(' 581 026 ')).toBe(true);
    expect(isEditCodeValid('000000')).toBe(false);
  });
});

describe('days and periods', () => {
  it('maps dates to school days and falls back to Sunday on weekends', () => {
    expect(dayIdForDate(new Date(2026, 9, 19))).toBe('mon');
    expect(dayIdForDate(new Date(2026, 9, 23))).toBeNull();
    expect(defaultDayForDate(new Date(2026, 9, 24))).toBe('sun');
    expect(adjacentDay('sun', -1)).toBeNull();
    expect(adjacentDay('wed', 1)).toBe('thu');
  });

  it('formats period labels like the reference', () => {
    const [first] = DEFAULT_PERIODS;
    const last = DEFAULT_PERIODS[DEFAULT_PERIODS.length - 1];
    expect(first && formatPeriodLabel(first)).toBe('1. 8:00\u20108:50');
    expect(last && formatPeriodLabel(last)).toBe('13. 18:25\u201019:10');
  });

  it('validates the default bell schedule and finds the current period', () => {
    expect(validatePeriods(DEFAULT_PERIODS)).toEqual([]);
    expect(validatePeriods([{ number: 1, start: '9:00', end: '8:00' }])).toHaveLength(1);
    expect(currentPeriodIndex(DEFAULT_PERIODS, 8 * 60 + 10)).toBe(0);
    expect(currentPeriodIndex(DEFAULT_PERIODS, 10 * 60 + 40)).toBe(-1);
  });
});

describe('notices and events', () => {
  const notice = (id: string, date: string | null, createdAt: string): Notice => ({
    id, category: 'change', title: id, body: '', date, createdAt,
  });
  const event = (id: string, date: string, time: string | null, kind: SchoolEvent['kind'] = 'exam', group = ''): SchoolEvent => ({
    id, kind, title: id, date, time, group, notes: '',
  });

  it('sorts notices by date then creation time', () => {
    const sorted = sortNotices([notice('a', null, '1'), notice('b', '2026-10-01', '1'), notice('c', '2026-10-05', '1')]);
    expect(sorted.map((n) => n.id)).toEqual(['c', 'b', 'a']);
    expect(changesForDate(sorted, '2026-10-01').map((n) => n.id)).toEqual(['b']);
  });

  it('sorts, filters and groups events', () => {
    const list = [event('b', '2026-11-02', '10:00'), event('a', '2026-10-20', null, 'event', 'כימיה'), event('c', '2026-11-02', null)];
    expect(sortEvents(list).map((e) => e.id)).toEqual(['a', 'c', 'b']);
    expect(filterEvents(list, 'exam', '').map((e) => e.id)).toEqual(['b', 'c']);
    expect(filterEvents(list, 'all', 'כימיה').map((e) => e.id)).toEqual(['a']);
    expect(upcomingEvents(list, '2026-10-21').map((e) => e.id)).toEqual(['c', 'b']);
    expect(groupEventsByMonth(list).map((g) => g.month)).toEqual(['2026-10', '2026-11']);
    expect(monthGrid(new Date(2026, 9, 1))[0]?.getDay()).toBe(0);
  });

  it('exports events and the timetable as iCalendar', () => {
    const ics = buildIcsCalendar('בדיקה', eventsToIcsEvents([event('e1', '2026-10-20', null)]), new Date('2026-10-19T00:00:00Z'));
    expect(ics).toContain('DTSTART;VALUE=DATE:20261020');
    expect(ics).toContain('SUMMARY:מבחן: e1');
    const weekly = timetableToIcsEvents(createExampleTimetable(), new Date(2026, 9, 19));
    expect(weekly.length).toBeGreaterThan(20);
    expect(weekly.every((e) => e.rrule === 'FREQ=WEEKLY')).toBe(true);
    expect(weekly[0]?.start.getDay()).toBe(0);
  });

  it('escapes and folds iCalendar text', () => {
    expect(escapeIcsText('a,b;c\\d\ne')).toBe('a\\,b\\;c\\\\d\\ne');
    const folded = foldIcsLine(`SUMMARY:${'א'.repeat(80)}`);
    expect(folded.split('\r\n ').every((part) => new TextEncoder().encode(part).length <= 75)).toBe(true);
  });
});

describe('hebrew dates and greetings', () => {
  it('converts numbers to Hebrew numerals', () => {
    expect(toHebrewNumeral(8)).toBe('ח׳');
    expect(toHebrewNumeral(15)).toBe('ט״ו');
    expect(toHebrewNumeral(16)).toBe('ט״ז');
    expect(toHebrewNumeral(787)).toBe('תשפ״ז');
  });

  it('formats a Hebrew calendar date', () => {
    expect(formatHebrewDate(new Date(2026, 9, 19))).toBe('ח׳ חשוון תשפ״ז');
  });

  it('greets by time of day', () => {
    expect(greetingLine(8, 'דנה')).toBe('בוקר טוב, דנה');
    expect(greetingLine(22, '')).toBe('לילה טוב');
  });
});

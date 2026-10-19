/**
 * Minimal RFC 5545 (iCalendar) writer used to export the timetable and events so they
 * can be added to the iPhone Calendar app. Times are "floating" (device-local), which
 * is what a personal school timetable wants.
 */

export interface IcsEvent {
  uid: string;
  summary: string;
  description?: string;
  location?: string;
  /** Local start date-time, or a whole day when `allDay` is true. */
  start: Date;
  /** Local end date-time (exclusive end day for all-day events). */
  end: Date;
  allDay?: boolean;
  /** RRULE value without the "RRULE:" prefix, e.g. "FREQ=WEEKLY". */
  rrule?: string;
}

/** Escapes text per RFC 5545 §3.3.11 (backslash, semicolon, comma, newline). */
export function escapeIcsText(text: string): string {
  return text.replace(/\\/g, '\\\\').replace(/;/g, '\\;').replace(/,/g, '\\,').replace(/\r?\n/g, '\\n');
}

/** Folds a content line at 75 octets (UTF-8 aware) using CRLF + space continuation. */
export function foldIcsLine(line: string): string {
  const encoder = new TextEncoder();
  const out: string[] = [];
  let current = '';
  let bytes = 0;
  for (const char of line) {
    const size = encoder.encode(char).length;
    const limit = out.length === 0 ? 75 : 74; // continuation lines start with a space
    if (bytes + size > limit) {
      out.push(current);
      current = '';
      bytes = 0;
    }
    current += char;
    bytes += size;
  }
  out.push(current);
  return out.join('\r\n ');
}

/** Formats a Date as a floating local "YYYYMMDDTHHMMSS" value. */
function formatLocalDateTime(date: Date): string {
  const p = (n: number) => String(n).padStart(2, '0');
  return `${date.getFullYear()}${p(date.getMonth() + 1)}${p(date.getDate())}T${p(date.getHours())}${p(date.getMinutes())}00`;
}

/** Formats a Date as an all-day "YYYYMMDD" value. */
function formatLocalDate(date: Date): string {
  const p = (n: number) => String(n).padStart(2, '0');
  return `${date.getFullYear()}${p(date.getMonth() + 1)}${p(date.getDate())}`;
}

/** Formats a Date as a UTC timestamp for DTSTAMP. */
function formatUtcStamp(date: Date): string {
  return date.toISOString().replace(/[-:]/g, '').replace(/\.\d{3}/, '');
}

/** Serialises events into a complete VCALENDAR document. */
export function buildIcsCalendar(name: string, events: readonly IcsEvent[], now = new Date()): string {
  const lines = [
    'BEGIN:VCALENDAR',
    'VERSION:2.0',
    'PRODID:-//webtop-pwa (unofficial)//HE',
    'CALSCALE:GREGORIAN',
    `X-WR-CALNAME:${escapeIcsText(name)}`,
  ];
  for (const event of events) {
    lines.push('BEGIN:VEVENT', `UID:${event.uid}`, `DTSTAMP:${formatUtcStamp(now)}`);
    if (event.allDay) {
      lines.push(`DTSTART;VALUE=DATE:${formatLocalDate(event.start)}`, `DTEND;VALUE=DATE:${formatLocalDate(event.end)}`);
    } else {
      lines.push(`DTSTART:${formatLocalDateTime(event.start)}`, `DTEND:${formatLocalDateTime(event.end)}`);
    }
    if (event.rrule) lines.push(`RRULE:${event.rrule}`);
    lines.push(`SUMMARY:${escapeIcsText(event.summary)}`);
    if (event.location) lines.push(`LOCATION:${escapeIcsText(event.location)}`);
    if (event.description) lines.push(`DESCRIPTION:${escapeIcsText(event.description)}`);
    lines.push('END:VEVENT');
  }
  lines.push('END:VCALENDAR');
  return lines.map(foldIcsLine).join('\r\n') + '\r\n';
}

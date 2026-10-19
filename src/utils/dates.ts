/** Calendar-date helpers that work on local dates and ISO "YYYY-MM-DD" strings. */

/** Formats a Date as a local ISO day string (no timezone shift, unlike toISOString). */
export function toIsoDate(date: Date): string {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, '0');
  const d = String(date.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

/** Parses an ISO day string into a local Date at midnight. */
export function fromIsoDate(iso: string): Date {
  const [y = 1970, m = 1, d = 1] = iso.split('-').map(Number);
  return new Date(y, m - 1, d);
}

/** Formats a date as "DD/MM/YYYY", matching the reference's date style. */
export function formatDmy(date: Date): string {
  const d = String(date.getDate()).padStart(2, '0');
  const m = String(date.getMonth() + 1).padStart(2, '0');
  return `${d}/${m}/${date.getFullYear()}`;
}

/** Formats an ISO day as "DD/MM/YYYY". */
export function formatIsoDmy(iso: string): string {
  return formatDmy(fromIsoDate(iso));
}

/** Returns a new Date shifted by a whole number of days. */
export function addDays(date: Date, days: number): Date {
  const next = new Date(date);
  next.setDate(next.getDate() + days);
  return next;
}

/** Returns the Sunday that starts the (Israeli) school week containing `date`. */
export function startOfWeek(date: Date): Date {
  const start = new Date(date.getFullYear(), date.getMonth(), date.getDate());
  start.setDate(start.getDate() - start.getDay());
  return start;
}

/** Hebrew weekday name for a date, e.g. "יום שני". */
export function hebrewWeekdayName(date: Date): string {
  return new Intl.DateTimeFormat('he-IL', { weekday: 'long' }).format(date);
}

/** Hebrew month+year label for a date, e.g. "אוקטובר 2026". */
export function hebrewMonthLabel(date: Date): string {
  return new Intl.DateTimeFormat('he-IL', { month: 'long', year: 'numeric' }).format(date);
}

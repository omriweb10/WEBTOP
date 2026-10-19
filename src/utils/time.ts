/** Helpers for "H:MM" wall-clock strings used by periods and events. */

/** Converts "H:MM"/"HH:MM" to minutes since midnight; returns NaN for malformed input. */
export function timeToMinutes(time: string): number {
  const match = /^(\d{1,2}):(\d{2})$/.exec(time);
  if (!match) return Number.NaN;
  return Number(match[1]) * 60 + Number(match[2]);
}

/** Formats minutes since midnight as "H:MM" (no leading zero on the hour, like the reference UI). */
export function minutesToTime(minutes: number): string {
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  return `${h}:${String(m).padStart(2, '0')}`;
}

/** Normalises a time string to the "H:MM" display form (e.g. "08:00" -> "8:00"). */
export function normalizeTime(time: string): string {
  const minutes = timeToMinutes(time);
  return Number.isNaN(minutes) ? time : minutesToTime(minutes);
}

/** Pads a time to "HH:MM" as required by <input type="time"> and iCalendar. */
export function toTwoDigitTime(time: string): string {
  const minutes = timeToMinutes(time);
  if (Number.isNaN(minutes)) return time;
  return `${String(Math.floor(minutes / 60)).padStart(2, '0')}:${String(minutes % 60).padStart(2, '0')}`;
}

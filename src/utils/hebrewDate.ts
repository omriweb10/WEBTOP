/**
 * Hebrew (Jewish) calendar date formatting, e.g. "ח׳ חשוון תשפ״ז".
 * Intl provides the calendar conversion; the letter numerals (gematria) are added here
 * because Intl only emits Arabic digits for the Hebrew calendar.
 */

const ONES = ['', 'א', 'ב', 'ג', 'ד', 'ה', 'ו', 'ז', 'ח', 'ט'];
const TENS = ['', 'י', 'כ', 'ל', 'מ', 'נ', 'ס', 'ע', 'פ', 'צ'];
const HUNDREDS = ['', 'ק', 'ר', 'ש', 'ת'];

/**
 * Converts 1–999 to Hebrew letter numerals with geresh/gershayim punctuation.
 * 15 and 16 use the traditional ט״ו / ט״ז forms.
 */
export function toHebrewNumeral(value: number): string {
  if (!Number.isInteger(value) || value <= 0 || value >= 1000) return String(value);
  let n = value;
  let letters = '';
  while (n >= 400) {
    letters += 'ת';
    n -= 400;
  }
  letters += HUNDREDS[Math.floor(n / 100)] ?? '';
  n %= 100;
  if (n === 15) letters += 'טו';
  else if (n === 16) letters += 'טז';
  else letters += (TENS[Math.floor(n / 10)] ?? '') + (ONES[n % 10] ?? '');

  if (letters.length === 1) return `${letters}׳`;
  return `${letters.slice(0, -1)}״${letters.slice(-1)}`;
}

/** Formats a Gregorian date as a Hebrew-calendar label such as "ח׳ חשוון תשפ״ז". */
export function formatHebrewDate(date: Date): string {
  const parts = new Intl.DateTimeFormat('he-IL-u-ca-hebrew', {
    day: 'numeric',
    month: 'long',
    year: 'numeric',
  }).formatToParts(date);
  const day = Number(parts.find((p) => p.type === 'day')?.value);
  const month = parts.find((p) => p.type === 'month')?.value ?? '';
  const year = Number(parts.find((p) => p.type === 'year')?.value);
  if (!Number.isFinite(day) || !Number.isFinite(year)) return '';
  return `${toHebrewNumeral(day)} ${month} ${toHebrewNumeral(year % 1000)}`;
}

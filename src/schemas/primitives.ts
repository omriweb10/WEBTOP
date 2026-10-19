/**
 * Reusable zod primitives shared by every persisted/imported schema.
 * Limits are deliberately generous for real use but bounded, so a malicious or
 * corrupted import cannot balloon local storage.
 */
import { z } from 'zod';

export const IdSchema = z
  .string()
  .min(1)
  .max(64)
  .regex(/^[A-Za-z0-9_-]+$/, 'מזהה לא תקין');

export const HexColorSchema = z.string().regex(/^#[0-9a-fA-F]{6}$/, 'צבע חייב להיות בפורמט ‎#RRGGBB');

export const TimeSchema = z.string().regex(/^([01]?\d|2[0-3]):[0-5]\d$/, 'שעה בפורמט HH:MM');

/** Checks that an ISO "YYYY-MM-DD" string names a real calendar day (rejects 2026-02-31). */
function isRealIsoDate(value: string): boolean {
  const [y, m, d] = value.split('-').map(Number);
  if (y === undefined || m === undefined || d === undefined) return false;
  const date = new Date(Date.UTC(y, m - 1, d));
  return date.getUTCFullYear() === y && date.getUTCMonth() === m - 1 && date.getUTCDate() === d;
}

export const IsoDateSchema = z
  .string()
  .regex(/^\d{4}-\d{2}-\d{2}$/, 'תאריך בפורמט YYYY-MM-DD')
  .refine(isRealIsoDate, 'תאריך לא קיים');

/** Bounded free text; `min` defaults to 0 so optional fields may be empty strings. */
export function textSchema(max: number, min = 0) {
  const base = z.string().max(max, `עד ${max} תווים`);
  return min > 0 ? base.min(min, 'שדה חובה') : base;
}

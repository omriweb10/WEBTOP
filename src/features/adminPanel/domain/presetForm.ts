/** Validation for the subject preset form (mirrors the database checks). */
import type { PresetFields } from '../api/types';

export const PRESET_LIMITS = { name: 80, short_name: 40, teacher: 80, room: 80, notes: 300 } as const;

export type PresetErrors = Partial<Record<keyof PresetFields, string>>;

export const EMPTY_PRESET_FIELDS: PresetFields = { name: '', short_name: '', teacher: '', room: '', color: '#1498fd', notes: '' };

/** Trims text fields and lower-cases the colour. */
export function cleanPreset(fields: PresetFields): PresetFields {
  return {
    name: fields.name.trim(),
    short_name: fields.short_name.trim(),
    teacher: fields.teacher.trim(),
    room: fields.room.trim(),
    color: fields.color.toLowerCase(),
    notes: fields.notes.trim(),
  };
}

/** Returns field errors; empty object = valid. */
export function validatePreset(fields: PresetFields): PresetErrors {
  const clean = cleanPreset(fields);
  const errors: PresetErrors = {};
  if (!clean.name) errors.name = 'יש להזין שם מקצוע';
  for (const key of Object.keys(PRESET_LIMITS) as Array<keyof typeof PRESET_LIMITS>) {
    if (clean[key].length > PRESET_LIMITS[key]) errors[key] = `עד ${PRESET_LIMITS[key]} תווים`;
  }
  if (!/^#[0-9a-f]{6}$/.test(clean.color)) errors.color = 'צבע בפורמט ‎#RRGGBB';
  return errors;
}

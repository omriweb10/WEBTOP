/** Validation for the student details form (mirrors the database checks). */
import type { ProfileFields } from '../api/types';

export const PROFILE_LIMITS = { display_name: 60, class_name: 30, school_name: 80, bio: 300 } as const;

export type ProfileErrors = Partial<Record<keyof ProfileFields, string>>;

export const EMPTY_PROFILE: ProfileFields = { display_name: '', class_name: '', school_name: '', bio: '' };

/** Trims every field. */
export function cleanProfile(fields: ProfileFields): ProfileFields {
  return {
    display_name: fields.display_name.trim(),
    class_name: fields.class_name.trim(),
    school_name: fields.school_name.trim(),
    bio: fields.bio.trim(),
  };
}

/** Returns field errors; empty object = valid. */
export function validateProfile(fields: ProfileFields): ProfileErrors {
  const clean = cleanProfile(fields);
  const errors: ProfileErrors = {};
  if (!clean.display_name) errors.display_name = 'יש להזין שם תצוגה';
  for (const key of Object.keys(PROFILE_LIMITS) as Array<keyof ProfileFields>) {
    if (clean[key].length > PROFILE_LIMITS[key]) errors[key] = `עד ${PROFILE_LIMITS[key]} תווים`;
  }
  return errors;
}

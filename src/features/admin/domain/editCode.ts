/**
 * Demonstration code for the hidden local edit mode.
 *
 * IMPORTANT: this is a UI convenience that keeps editing controls out of the way during
 * normal viewing — it is NOT authentication. Anyone can read it from the bundle, it
 * protects nothing, and it has no relation to any official WEBTOP account or backend.
 */
export const EDIT_MODE_CODE = '581026';

/** Compares user input (digits only, whitespace ignored) with the demonstration code. */
export function isEditCodeValid(input: string): boolean {
  return input.replace(/\s+/g, '') === EDIT_MODE_CODE;
}

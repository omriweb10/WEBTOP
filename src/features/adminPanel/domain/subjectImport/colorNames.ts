/**
 * Colour normalisation for imported subjects: HEX values (#RGB, #RRGGBB, or RRGGBB) and
 * common Hebrew colour names become one lower-case #rrggbb value. Names map to the app's
 * subject palette where it has a matching swatch, so imported colours look like the rest.
 */
import { SUBJECT_COLORS } from '../../../../data/subjectPalette';

const NAMED: ReadonlyArray<[names: string[], hex: string]> = [
  [['כחול', 'כחולה'], SUBJECT_COLORS.math],
  [['אדום', 'אדומה'], '#e53935'],
  [['ירוק', 'ירוקה'], SUBJECT_COLORS.biology],
  [['צהוב', 'צהובה'], SUBJECT_COLORS.homeroom],
  [['כתום', 'כתומה'], '#e67e22'],
  [['סגול', 'סגולה'], '#8e44ad'],
  [['אפור', 'אפורה'], SUBJECT_COLORS.english],
  [['ורוד', 'ורודה'], SUBJECT_COLORS.signLanguage],
  [['טורקיז', 'תכלת'], SUBJECT_COLORS.bible],
  [['חום', 'חומה'], '#795548'],
];

/** Hebrew colour name → HEX. */
export const COLOR_NAMES: ReadonlyMap<string, string> = new Map(NAMED.flatMap(([names, hex]) => names.map((name) => [name, hex] as const)));

/** The names listed in messages (one form each). */
export const COLOR_NAME_LIST: readonly string[] = NAMED.map(([names]) => names[0] ?? '');

/** Normalises a colour written in the text; null when it is not a supported colour. */
export function normalizeColor(value: string): string | null {
  const text = value.trim().replace(/[.,;]+$/, '');
  const hex = /^#?([0-9a-f]{6})$/i.exec(text)?.[1] ?? expandShortHex(text);
  if (hex) return `#${hex.toLowerCase()}`;
  return COLOR_NAMES.get(text.replace(/\s+/g, ' ')) ?? null;
}

/** "#1af" → "11aaff" (the short form needs its '#', so a bare number is never a colour). */
function expandShortHex(text: string): string | null {
  const short = /^#([0-9a-f]{3})$/i.exec(text)?.[1];
  return short ? [...short].map((c) => c + c).join('') : null;
}

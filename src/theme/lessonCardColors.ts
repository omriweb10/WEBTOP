/**
 * Lesson-card colours per theme. The subject's accent colour is identical in both themes
 * (the coloured edge); only the card tint behind the text changes:
 *  - dark:  accent mixed into the table surface at 16% (sampled from the dark recording)
 *  - light: accent mixed into white at 20% (sampled from the light screenshot: maths,
 *           education, Hebrew, chemistry and biology cards match within 1–3 RGB units)
 * Computed in JS (not color-mix) so iOS versions without color-mix render the same tints.
 */
import type { CSSProperties } from 'react';
import { mixHex } from '../utils/color';
import type { ResolvedTheme } from './themeConfig';

export const CARD_TINTS: Record<ResolvedTheme, { base: string; ratio: number }> = {
  dark: { base: '#191e29', ratio: 0.16 },
  light: { base: '#ffffff', ratio: 0.2 },
};

/** Background of a lesson card with this accent colour in this theme. */
export function lessonCardBackground(accent: string, theme: ResolvedTheme): string {
  const tint = CARD_TINTS[theme];
  return mixHex(accent, tint.base, tint.ratio);
}

/** Inline style for a card: accent edge plus the themed tint. */
export function lessonCardStyle(accent: string, theme: ResolvedTheme): CSSProperties {
  return { '--lesson-accent': accent, backgroundColor: lessonCardBackground(accent, theme) } as CSSProperties;
}

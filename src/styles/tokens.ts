/**
 * Design tokens needed from TypeScript (must mirror src/styles/tokens.css).
 * Kept tiny on purpose: everything purely presentational stays in CSS.
 */

/** Table/card surface colour (tokens.css --color-surface). */
export const SURFACE_COLOR = '#191e29';

/**
 * Lesson-card background = subject accent mixed into the surface at this ratio.
 * Derived from the recording: sampled card backgrounds match a 15–17% mix for every subject.
 */
export const CARD_TINT_RATIO = 0.16;

/** Browser/OS chrome colour (manifest theme_color, <meta name="theme-color">). */
export const THEME_COLOR = '#12161c';

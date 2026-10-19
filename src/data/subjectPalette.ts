/**
 * Subject accent colours (the coloured edge of each lesson card). Values come from the
 * project brief and were cross-checked against frames of the reference recording; the
 * sampled values differ only by video-compression error. Card backgrounds are derived
 * from these accents in CSS (see --card-tint in tokens.css), not stored separately.
 */
export const SUBJECT_COLORS = {
  english: '#999a9d',
  math: '#1498fd',
  history: '#444cc1',
  hebrew: '#f4490c',
  bible: '#04b9d4',
  signLanguage: '#e50066',
  homeroom: '#ffbe10',
  physicalEducation: '#059f8b',
  chemistry: '#92be43',
  biology: '#259e3b',
} as const;

/** Swatches offered by the colour picker (subject accents first, then a few extras). */
export const COLOR_SWATCHES: readonly string[] = [
  ...Object.values(SUBJECT_COLORS),
  '#8e44ad',
  '#e67e22',
  '#795548',
  '#607d8b',
];

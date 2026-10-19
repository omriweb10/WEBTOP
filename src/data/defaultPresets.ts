/**
 * Default subject presets.
 *
 * Subject names and colours are generic and safe to publish. The teacher and room
 * values are FICTIONAL EXAMPLES ("מורה ל…", rooms 101–112) — this public repository
 * deliberately contains no real teacher names or school rooms. Real values belong in a
 * private backup file that the user imports locally (see README → "Private data").
 */
import type { Preset } from '../schemas/presets';
import { SUBJECT_COLORS } from './subjectPalette';

export const DEFAULT_PRESETS: readonly Preset[] = [
  { id: 'preset_english', name: 'אנגלית', subject: 'אנגלית 5 (רמה: 5 יח``ל)', teacher: 'מורה לאנגלית', room: '101', color: SUBJECT_COLORS.english },
  { id: 'preset_math', name: 'מתמטיקה', subject: 'מתמטיקה 4 (רמה: 4 יח``ל)', teacher: 'מורה למתמטיקה', room: '102', color: SUBJECT_COLORS.math },
  { id: 'preset_history', name: 'היסטוריה', subject: 'היסטוריה', teacher: 'מורה להיסטוריה', room: '103', color: SUBJECT_COLORS.history },
  { id: 'preset_hebrew', name: 'לשון', subject: 'לשון', teacher: 'מורה ללשון', room: '103', color: SUBJECT_COLORS.hebrew },
  { id: 'preset_bible', name: 'תנ"ך', subject: 'תנ"ך', teacher: 'מורה לתנ"ך', room: '103', color: SUBJECT_COLORS.bible },
  { id: 'preset_sign', name: 'שפת סימנים', subject: 'שפת סימנים', teacher: 'מורה לשפת סימנים', room: '104', color: SUBJECT_COLORS.signLanguage },
  { id: 'preset_homeroom', name: 'חינוך', subject: 'חינוך', teacher: 'מחנך/ת הכיתה', room: '103', color: SUBJECT_COLORS.homeroom },
  { id: 'preset_pe', name: 'חינוך גופני', subject: 'חינוך גופני', teacher: 'מורה לחינוך גופני', room: '', color: SUBJECT_COLORS.physicalEducation },
  { id: 'preset_chemistry', name: 'כימיה', subject: 'א כימיה', teacher: 'מורה לכימיה', room: '110', color: SUBJECT_COLORS.chemistry },
  { id: 'preset_robotics', name: 'רובוטיקה', subject: 'ב רובוטיקה', teacher: 'מורה לרובוטיקה', room: '111', color: SUBJECT_COLORS.biology },
  { id: 'preset_biology', name: 'ביוטכנולוגיה / ביולוגיה', subject: 'ביוטכנולוגיה', teacher: 'מורה לביולוגיה', room: '112', color: SUBJECT_COLORS.biology },
  { id: 'preset_traffic', name: 'חינוך תעבורתי', subject: 'חינוך תעבורתי', teacher: 'מורה לחינוך תעבורתי', room: '103', color: SUBJECT_COLORS.signLanguage },
];

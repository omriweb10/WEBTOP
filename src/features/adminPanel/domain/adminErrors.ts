/** Turns backend failures into short Hebrew explanations for the admin. */
import { isNetworkError } from '../../../services/supabase/errors';

/** Error thrown by the admin API wrappers; `message` is already user-facing. */
export class AdminError extends Error {
  readonly code: string;
  constructor(code: string, message: string) {
    super(message);
    this.name = 'AdminError';
    this.code = code;
  }
}

const MESSAGES: Record<string, string> = {
  profile_not_found: 'המשתמש לא נמצא (ייתכן שנמחק בינתיים).',
  template_not_found: 'התבנית לא נמצאה (ייתכן שנמחקה בינתיים).',
  timetable_not_found: 'מערכת השעות של המשתמש לא נמצאה.',
  invalid_periods: 'רשימת השעות אינה תקינה: 1–13 שעות, כל שעה מסתיימת אחרי שהתחילה ואין חפיפות.',
  invalid_lessons: 'רשימת השיעורים אינה תקינה.',
  invalid_changes: 'השינויים אינם תקינים.',
  invalid_day: 'יום לא תקין.',
  invalid_period: 'שעה מחוץ לטווח המערכת.',
  period_out_of_range: 'שעה מחוץ לטווח המערכת.',
  preset_unavailable: 'אחד המקצועות מוסתר (בארכיון) או שאינו קיים.',
  preset_not_assigned: 'המקצוע אינו שייך למשתמש הזה. אפשר לשבץ רק מקצועות מהרשימה האישית שלו.',
  preset_not_found: 'המקצוע לא נמצא (ייתכן שנמחק בינתיים).',
  preset_in_use: 'המקצוע משובץ במערכת השעות. בחרו מה לעשות בשיעורים שלו לפני ההסרה.',
  preset_in_template: 'המקצוע משמש בתבנית ולכן אי אפשר להסיר אותו. הסירו אותו מהתבניות או העבירו אותו לארכיון.',
  preset_not_in_library: 'בתבנית אפשר להשתמש רק במקצועות מהמאגר.',
  invalid_replacement: 'המקצוע החלופי חייב להיות מקצוע פעיל אחר של אותו משתמש.',
  too_many_items: 'יותר מדי פריטים בפעולה אחת. בחרו פחות ונסו שוב.',
  code_taken: 'הקוד הזה כבר בשימוש אצל משתמש אחר. בחרו קוד אחר.',
  code_too_short: 'הקוד קצר מדי (לפחות 6 תווים).',
  code_too_long: 'הקוד ארוך מדי (עד 64 תווים).',
  code_too_weak: 'הקוד חלש מדי.',
  admin_required: 'נדרשת התחברות מנהל.',
  invalid_request: 'הבקשה אינה תקינה.',
  forbidden: 'אין הרשאת ניהול לפעולה הזו.',
  '23503': 'הפריט נמצא בשימוש ולכן אי אפשר למחוק אותו.',
  '23514': 'אחד השדות אינו תקין (אורך או פורמט).',
  '23505': 'קיים כבר פריט כזה.',
  '42501': 'אין הרשאת ניהול לפעולה הזו. ייתכן שההתחברות כמנהל פגה — התחברו מחדש.',
  PGRST301: 'ההתחברות כמנהל פגה. התחברו מחדש.',
  '22P02': 'ערך לא תקין.',
};

/** Normalises any backend error into an AdminError. */
export function toAdminError(error: unknown): AdminError {
  if (error instanceof AdminError) return error;
  if (isNetworkError(error)) return new AdminError('network', 'אין חיבור לשרת. בדקו את החיבור ונסו שוב.');
  const raw = (typeof error === 'object' && error !== null ? error : {}) as { code?: unknown; message?: unknown };
  const code = typeof raw.code === 'string' ? raw.code : '';
  const message = typeof raw.message === 'string' ? raw.message : '';
  const known = MESSAGES[message] ?? MESSAGES[code];
  return new AdminError(code || message || 'unknown', known ?? 'הפעולה נכשלה. נסו שוב.');
}

/** Message for display, from anything thrown. */
export function errorMessage(error: unknown): string {
  return toAdminError(error).message;
}

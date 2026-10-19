/** Date/time and other wording used across the admin panel. */

/** "19/10/2026 14:05" (Hebrew locale), or a dash. */
export function formatDateTime(iso: string | null | undefined): string {
  if (!iso) return '—';
  const date = new Date(iso);
  return Number.isNaN(date.getTime()) ? '—' : date.toLocaleString('he-IL', { dateStyle: 'short', timeStyle: 'short' });
}

/** "19/10/2026", or a dash. */
export function formatDate(iso: string | null | undefined): string {
  if (!iso) return '—';
  const date = new Date(iso.length === 10 ? `${iso}T12:00:00` : iso);
  return Number.isNaN(date.getTime()) ? '—' : date.toLocaleDateString('he-IL');
}

/** "עכשיו", "לפני 5 דקות", "לפני 3 שעות", "לפני 2 ימים" or the date. */
export function formatRelative(iso: string | null | undefined, now = Date.now()): string {
  if (!iso) return 'אף פעם';
  const time = Date.parse(iso);
  if (!Number.isFinite(time)) return '—';
  const minutes = Math.round((now - time) / 60_000);
  if (minutes < 1) return 'עכשיו';
  if (minutes < 60) return minutes === 1 ? 'לפני דקה' : `לפני ${minutes} דקות`;
  const hours = Math.round(minutes / 60);
  if (hours < 24) return hours === 1 ? 'לפני שעה' : `לפני ${hours} שעות`;
  const days = Math.round(hours / 24);
  if (days < 14) return days === 1 ? 'אתמול' : `לפני ${days} ימים`;
  return formatDate(iso);
}

/** Why a session ended, in words. */
export function endReasonLabel(reason: string | null): string {
  switch (reason) {
    case 'logout':
      return 'התנתקות של המשתמש';
    case 'admin_disconnect':
      return 'נותק על ידי מנהל';
    case 'code_revoked':
      return 'הקוד בוטל או הוחלף';
    case 'account_disabled':
      return 'החשבון הושבת';
    case 'account_deleted':
      return 'החשבון נמחק';
    case 'login_aborted':
      return 'התחברות שלא הושלמה';
    default:
      return '—';
  }
}

/** "מורה · חדר 12", or a fallback when neither is set. */
export function presetDetails(preset: { teacher: string; room: string }, fallback = 'ללא מורה וחדר'): string {
  return [preset.teacher, preset.room && `חדר ${preset.room}`].filter(Boolean).join(' · ') || fallback;
}

/** How many lessons use a preset, in words. */
export function lessonUsageLabel(count: number): string {
  if (count <= 0) return 'לא משובץ';
  return count === 1 ? 'משובץ בשיעור אחד' : `משובץ ב‑${count} שיעורים`;
}

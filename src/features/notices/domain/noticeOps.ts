/** Pure list operations for locally stored notices ("הודעות כלליות" / "שינויי מערכת"). */
import type { Notice, NoticeCategory } from '../../../schemas/content';

export const NOTICE_CATEGORY_LABELS: Record<NoticeCategory, string> = {
  general: 'הודעות כלליות',
  change: 'שינויי מערכת',
};

/** Sorts notices: dated ones by date (newest first), then undated by creation time (newest first). */
export function sortNotices(notices: readonly Notice[]): Notice[] {
  return [...notices].sort((a, b) => {
    if (a.date && b.date && a.date !== b.date) return a.date < b.date ? 1 : -1;
    if (a.date && !b.date) return -1;
    if (!a.date && b.date) return 1;
    return a.createdAt < b.createdAt ? 1 : a.createdAt > b.createdAt ? -1 : 0;
  });
}

/** Returns the sorted notices of one category. */
export function noticesInCategory(notices: readonly Notice[], category: NoticeCategory): Notice[] {
  return sortNotices(notices.filter((n) => n.category === category));
}

/** Schedule-change notices that refer to a given ISO day (used for the timetable alert). */
export function changesForDate(notices: readonly Notice[], isoDate: string): Notice[] {
  return notices.filter((n) => n.category === 'change' && n.date === isoDate);
}

/** Inserts or replaces a notice by id. */
export function upsertNotice(notices: readonly Notice[], notice: Notice): Notice[] {
  const exists = notices.some((n) => n.id === notice.id);
  return exists ? notices.map((n) => (n.id === notice.id ? notice : n)) : [...notices, notice];
}

/** Removes a notice by id. */
export function removeNotice(notices: readonly Notice[], id: string): Notice[] {
  return notices.filter((n) => n.id !== id);
}

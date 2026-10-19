/** Searching and classifying students in the admin lists. */
import type { UserOverview } from '../api/types';

/** A session counts as "active now" when the app reported activity this recently. */
export const ACTIVE_NOW_MS = 3 * 60_000;

export type ConnectionState = 'active-now' | 'signed-in' | 'signed-out';

/** Whether the student is signed in somewhere, and whether that device is in use right now. */
export function connectionState(lastSeenAt: string | null, hasSession: boolean, now = Date.now()): ConnectionState {
  if (!hasSession) return 'signed-out';
  const seen = lastSeenAt ? Date.parse(lastSeenAt) : NaN;
  return Number.isFinite(seen) && now - seen <= ACTIVE_NOW_MS ? 'active-now' : 'signed-in';
}

export type UserFilter = 'all' | 'connected' | 'no-code' | 'disabled';

/** Lower-cased, diacritic-free text for forgiving Hebrew/Latin search. */
function fold(text: string): string {
  return text.normalize('NFKD').replace(/[֑-ׇ̀-ͯ]/g, '').toLowerCase();
}

/** Filters by free text (name, class, school) and by status chip. */
export function filterUsers(users: readonly UserOverview[], query: string, filter: UserFilter): UserOverview[] {
  const needle = fold(query.trim());
  return users.filter((user) => {
    if (filter === 'connected' && !user.session_id) return false;
    if (filter === 'no-code' && user.code_id) return false;
    if (filter === 'disabled' && user.status !== 'disabled') return false;
    if (!needle) return true;
    return fold(`${user.display_name} ${user.class_name} ${user.school_name}`).includes(needle);
  });
}

/** Counts for the filter chips. */
export function userCounts(users: readonly UserOverview[]): Record<UserFilter, number> {
  return {
    all: users.length,
    connected: users.filter((u) => u.session_id).length,
    'no-code': users.filter((u) => !u.code_id).length,
    disabled: users.filter((u) => u.status === 'disabled').length,
  };
}

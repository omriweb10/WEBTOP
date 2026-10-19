/** A single student's own timetable, as the admin sees and edits it. */
import type { Period } from '../../../schemas/timetable';
import type { LessonChange } from '../../account/domain/bundle';
import { db, unwrap } from './adminClient';
import type { LessonRow, UserTimetable } from './types';

/** Periods, customisation flag and lessons of one student. */
export async function getUserTimetable(profileId: string): Promise<UserTimetable> {
  const [meta, lessons] = await Promise.all([
    unwrap<Omit<UserTimetable, 'lessons'>>(
      db().from('user_timetables').select('periods, customized, source_template_id').eq('profile_id', profileId).single(),
    ),
    unwrap<LessonRow[]>(db().from('lessons').select('day, period_index, preset_id').eq('profile_id', profileId)),
  ]);
  return { ...meta, lessons };
}

/** Applies cell changes; placed presets also become available to the student. */
export async function saveUserLessons(profileId: string, changes: readonly LessonChange[]): Promise<void> {
  await unwrap(db().rpc('admin_save_user_lessons', { p_profile_id: profileId, p_changes: changes }));
}

/** Replaces the student's bell schedule (lessons beyond the last period are removed). */
export async function setUserPeriods(profileId: string, periods: Period[]): Promise<void> {
  await unwrap(db().rpc('admin_set_user_periods', { p_profile_id: profileId, p_periods: periods }));
}

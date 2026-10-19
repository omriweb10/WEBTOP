/**
 * Choices offered when removing a preset that is still placed in the student's timetable.
 * Removing never empties periods unless the admin explicitly picked 'delete'.
 */
import type { LessonsOnRemoval } from '../api/presetsApi';
import type { PresetRow } from '../api/types';

/** replace: move the lessons to another preset · delete: empty those periods · hide: keep everything, archive instead. */
export type RemovalChoice = 'replace' | 'delete' | 'hide';

/** Other active presets of the same student that can take over the lessons. */
export function replacementOptions(presets: readonly PresetRow[], removing: PresetRow): PresetRow[] {
  return presets.filter((p) => p.id !== removing.id && !p.archived_at && p.profile_id === removing.profile_id);
}

/** Whether the removal dialog has what it needs to proceed. */
export function canConfirmRemoval(removing: PresetRow, choice: RemovalChoice | null, replacementId: string): boolean {
  if (removing.lesson_count === 0) return true;
  if (choice === 'replace') return replacementId !== '';
  return choice !== null;
}

/** The server option for the chosen handling of the lessons ('hide' never removes). */
export function lessonsOption(removing: PresetRow, choice: RemovalChoice | null, replacementId: string): LessonsOnRemoval {
  if (removing.lesson_count === 0) return { kind: 'none' };
  if (choice === 'replace') return { kind: 'replace', replacementId };
  if (choice === 'delete') return { kind: 'delete' };
  return { kind: 'none' };
}

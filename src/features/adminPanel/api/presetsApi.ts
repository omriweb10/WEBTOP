/**
 * Subject presets. Each student owns an independent list; the library (no owner) holds
 * the admin's presets for templates and as a source to copy from. Students never see it.
 */
import { db, unwrap } from './adminClient';
import type { PresetFields, PresetRow } from './types';

const OVERVIEW = 'admin_preset_overview';

/** Library presets (archived ones included), with template usage. */
export async function listLibraryPresets(): Promise<PresetRow[]> {
  return unwrap<PresetRow[]>(db().from(OVERVIEW).select('*').is('profile_id', null).order('name'));
}

/** One student's own presets (archived ones included), with lesson usage. */
export async function listUserPresets(profileId: string): Promise<PresetRow[]> {
  return unwrap<PresetRow[]>(db().from(OVERVIEW).select('*').eq('profile_id', profileId).order('name').order('created_at'));
}

/** Creates a preset in a student's list (profileId) or in the library (null). */
export async function createPreset(profileId: string | null, fields: PresetFields): Promise<void> {
  await unwrap(db().from('subject_presets').insert({ ...fields, profile_id: profileId }));
}

/**
 * Creates several presets in one student's list with a single insert, so either all of
 * them are created or none (the database checks the admin, the student and every field).
 */
export async function createPresets(profileId: string, list: readonly PresetFields[]): Promise<void> {
  if (list.length === 0) return;
  await unwrap(db().from('subject_presets').insert(list.map((fields) => ({ ...fields, profile_id: profileId }))));
}

/** Overwrites a preset's subject, teacher, room and colour, and makes it selectable again. */
export async function replacePresetDetails(id: string, fields: Pick<PresetFields, 'name' | 'teacher' | 'room' | 'color'>): Promise<void> {
  await unwrap(db().from('subject_presets').update({ ...fields, archived_at: null }).eq('id', id));
}

/** Updates a preset; only its owner (or the library's templates) is affected. */
export async function updatePreset(id: string, fields: Partial<PresetFields>): Promise<void> {
  await unwrap(db().from('subject_presets').update(fields).eq('id', id));
}

/** Hides (archives) or restores a preset: archived presets cannot be newly placed. */
export async function setPresetArchived(id: string, archived: boolean): Promise<void> {
  await unwrap(db().from('subject_presets').update({ archived_at: archived ? new Date().toISOString() : null }).eq('id', id));
}

/**
 * Copies presets (from the library or another student) into each target student's list
 * as new, independent presets. Returns how many were created.
 */
export async function copyPresets(presetIds: readonly string[], profileIds: readonly string[]): Promise<number> {
  return unwrap<number>(db().rpc('admin_copy_presets', { p_preset_ids: presetIds, p_profile_ids: profileIds }));
}

/** What happens to the lessons of a preset that is being removed while still placed. */
export type LessonsOnRemoval = { kind: 'none' } | { kind: 'delete' } | { kind: 'replace'; replacementId: string };

/**
 * Removes a preset. The server refuses (preset_in_use) when it is still placed and no
 * choice was made, so lessons are never deleted silently. Returns the lessons affected.
 */
export async function removePreset(id: string, lessons: LessonsOnRemoval = { kind: 'none' }): Promise<number> {
  return unwrap<number>(
    db().rpc('admin_remove_preset', {
      p_preset_id: id,
      p_lessons: lessons.kind === 'none' ? null : lessons.kind,
      p_replacement_id: lessons.kind === 'replace' ? lessons.replacementId : null,
    }),
  );
}

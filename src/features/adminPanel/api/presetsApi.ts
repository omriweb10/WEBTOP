/** Subject presets and which students may use them. */
import { db, unwrap } from './adminClient';
import type { PresetFields, PresetRow } from './types';

/** All presets, archived ones included. */
export async function listPresets(): Promise<PresetRow[]> {
  return unwrap<PresetRow[]>(db().from('subject_presets').select('*').order('name'));
}

/** Creates a preset; returns it. */
export async function createPreset(fields: PresetFields): Promise<PresetRow> {
  return unwrap<PresetRow>(db().from('subject_presets').insert(fields).select('*').single());
}

/** Updates a preset (students see the change; their timetables keep the placement). */
export async function updatePreset(id: string, fields: Partial<PresetFields>): Promise<void> {
  await unwrap(db().from('subject_presets').update(fields).eq('id', id));
}

/** Archives or restores a preset (archived presets cannot be newly placed). */
export async function setPresetArchived(id: string, archived: boolean): Promise<void> {
  await unwrap(db().from('subject_presets').update({ archived_at: archived ? new Date().toISOString() : null }).eq('id', id));
}

/** Deletes an unused preset (the database refuses while it is placed anywhere). */
export async function deletePreset(id: string): Promise<void> {
  await unwrap(db().from('subject_presets').delete().eq('id', id));
}

/** Preset ids a student may use. */
export async function listUserPresetIds(profileId: string): Promise<string[]> {
  const rows = await unwrap<Array<{ preset_id: string }>>(db().from('profile_presets').select('preset_id').eq('profile_id', profileId));
  return rows.map((r) => r.preset_id);
}

/** Replaces the set of presets a student may use. */
export async function setUserPresets(profileId: string, presetIds: readonly string[]): Promise<void> {
  await unwrap(db().rpc('admin_set_profile_presets', { p_profile_id: profileId, p_preset_ids: presetIds }));
}

/** Makes one preset available to several students; returns how many gained it. */
export async function addPresetToUsers(presetId: string, profileIds: readonly string[]): Promise<number> {
  return unwrap<number>(db().rpc('admin_add_preset_to_profiles', { p_preset_id: presetId, p_profile_ids: profileIds }));
}

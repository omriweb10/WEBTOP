/** Pure helpers for duplicating a preset and copying presets between students' lists. */
import type { PresetFields, PresetRow } from '../api/types';
import { PRESET_LIMITS } from './presetForm';

export const COPY_SUFFIX = ' (עותק)';

/** Form values for a duplicate: the same details, with the name marked as a copy. */
export function duplicateFields(preset: PresetFields): PresetFields {
  const name = preset.name.trim().slice(0, PRESET_LIMITS.name - COPY_SUFFIX.length) + COPY_SUFFIX;
  return { name, short_name: preset.short_name, teacher: preset.teacher, room: preset.room, color: preset.color, notes: preset.notes };
}

/** Comparison key for spotting the same subject name in two lists (spacing and case). */
export function nameKey(name: string): string {
  return name.trim().replace(/\s+/g, ' ').toLocaleLowerCase();
}

export interface CopyCandidate {
  preset: PresetRow;
  /** The target's active preset with the same name, if it already has one. */
  existing: PresetRow | null;
}

/**
 * Presets that can be copied from a source list into a target list: active ones only,
 * each paired with the target's same-named preset so the admin can avoid duplicates.
 */
export function copyCandidates(source: readonly PresetRow[], target: readonly PresetRow[]): CopyCandidate[] {
  const byName = new Map<string, PresetRow>();
  for (const preset of target) if (!preset.archived_at && !byName.has(nameKey(preset.name))) byName.set(nameKey(preset.name), preset);
  return source.filter((preset) => !preset.archived_at).map((preset) => ({ preset, existing: byName.get(nameKey(preset.name)) ?? null }));
}

/** Initial selection: every candidate the target does not already have by name. */
export function defaultCopySelection(candidates: readonly CopyCandidate[]): Set<string> {
  return new Set(candidates.filter((c) => !c.existing).map((c) => c.preset.id));
}

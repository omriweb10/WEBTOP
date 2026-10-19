/**
 * Preset use-cases. Coordinates the presets store with the timetable store when the user
 * explicitly chooses to propagate a preset change to existing lessons.
 */
import type { Preset } from '../../schemas/presets';
import { usePresetsStore, useTimetableStore } from '../../store/dataStores';
import { timetableActions } from '../timetable/timetableActions';
import {
  applyPresetUpdateToLessons,
  detachPresetFromLessons,
  removePreset,
  upsertPreset,
} from './domain/presetOps';

/** How a preset edit affects lessons already using it. */
export type PresetApplyMode = 'none' | 'keep-custom' | 'overwrite';

export const presetActions = {
  /** Creates or updates a preset and optionally propagates it to its lessons. */
  save(preset: Preset, applyMode: PresetApplyMode = 'none'): void {
    const presets = usePresetsStore.getState().value;
    const previous = presets.find((p) => p.id === preset.id);
    usePresetsStore.getState().set(upsertPreset(presets, preset));
    if (previous && applyMode !== 'none') {
      const timetable = useTimetableStore.getState().value;
      timetableActions.replace(applyPresetUpdateToLessons(timetable, previous, preset, applyMode === 'overwrite'));
    }
  },
  /** Deletes a preset; lessons keep their content but are detached from it. */
  remove(presetId: string): void {
    usePresetsStore.getState().update((presets) => removePreset(presets, presetId));
    const timetable = useTimetableStore.getState().value;
    timetableActions.replace(detachPresetFromLessons(timetable, presetId));
  },
  /** Restores the default preset list (lessons are not modified). */
  resetToDefault(): void {
    usePresetsStore.getState().reset();
  },
};

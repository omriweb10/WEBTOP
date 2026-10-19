/** Each student's own presets, cached per student for the user page's tabs and dialogs. */
import { useEffect } from 'react';
import { listUserPresets } from '../api/presetsApi';
import type { PresetRow } from '../api/types';
import { createKeyedResource, IDLE_ENTRY, type KeyedEntry } from './createKeyedResource';

export const useUserPresetsStore = createKeyedResource(listUserPresets);

/**
 * Loads (once) and returns one student's presets; null = no student chosen yet.
 * `reload` refetches after a change.
 */
export function useUserPresets(profileId: string | null): KeyedEntry<PresetRow[]> & { reload: () => Promise<void> } {
  const entry = useUserPresetsStore((state) => (profileId ? state.entries[profileId] : undefined)) ?? IDLE_ENTRY;
  const load = useUserPresetsStore((state) => state.load);

  useEffect(() => {
    if (profileId) void load(profileId);
  }, [profileId, load]);

  return { ...entry, reload: () => (profileId ? load(profileId, true) : Promise.resolve()) };
}

/** Refreshes students whose lists changed elsewhere (copies, template assignment). */
export function reloadUserPresets(profileIds: readonly string[]): void {
  useUserPresetsStore.getState().refresh(profileIds);
}

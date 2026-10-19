/** Writes the account snapshot into the app's data stores, or wipes it on sign-out. */
import { useEventsStore, useNoticesStore, usePresetsStore, useProfileStore, useTimetableStore } from '../../../store/dataStores';
import { useEditModeStore } from '../../admin/editModeStore';
import { clearTimetableHistory } from '../../timetable/timetableActions';
import { useAccountCache } from '../accountStore';
import type { AccountSnapshot } from '../domain/bundle';

/**
 * Applies a server snapshot. `includeTimetable` is false while local timetable edits are
 * still being saved, so a background refresh never overwrites them.
 */
export function applySnapshot(snapshot: AccountSnapshot, includeTimetable: boolean): void {
  const previous = useAccountCache.getState().value;
  if (previous?.profileId !== snapshot.summary.profileId) clearTimetableHistory();
  useAccountCache.getState().set(snapshot.summary);
  useProfileStore.getState().set(snapshot.profile);
  usePresetsStore.getState().set(snapshot.presets);
  useNoticesStore.getState().set(snapshot.notices);
  useEventsStore.getState().set(snapshot.events);
  if (includeTimetable) useTimetableStore.getState().set(snapshot.timetable);
}

/** Removes every trace of the account from this device (logout / session ended). */
export function clearAccountData(): void {
  useEditModeStore.getState().lock();
  clearTimetableHistory();
  useAccountCache.getState().reset();
  useProfileStore.getState().reset();
  usePresetsStore.getState().reset();
  useNoticesStore.getState().reset();
  useEventsStore.getState().reset();
  useTimetableStore.getState().reset();
}

/** One persisted store per data slice. Feature action modules wrap these with domain rules. */
import {
  eventsSlice,
  noticesSlice,
  presetsSlice,
  profileSlice,
  settingsSlice,
  timetableSlice,
} from '../services/storage/slices';
import { createPersistedStore } from './createPersistedStore';

export const useTimetableStore = createPersistedStore(timetableSlice);
export const usePresetsStore = createPersistedStore(presetsSlice);
export const useProfileStore = createPersistedStore(profileSlice);
export const useNoticesStore = createPersistedStore(noticesSlice);
export const useEventsStore = createPersistedStore(eventsSlice);
export const useSettingsStore = createPersistedStore(settingsSlice);

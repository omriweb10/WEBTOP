/** The persisted theme preference (Light / Dark / System). */
import { z } from 'zod';
import type { PersistedValueSpec } from '../services/storage/persistedValue';
import { createPersistedStore } from '../store/createPersistedStore';
import { DEFAULT_THEME_PREFERENCE, THEME_PREFERENCES, THEME_STORAGE_KEY, type ThemePreference } from './themeConfig';

export const themeSlice: PersistedValueSpec<ThemePreference> = {
  key: THEME_STORAGE_KEY,
  version: 1,
  schema: z.enum(THEME_PREFERENCES),
  defaults: () => DEFAULT_THEME_PREFERENCE,
};

export const useThemePreferenceStore = createPersistedStore(themeSlice);

/** Current preference (re-renders on change). */
export function useThemePreference(): ThemePreference {
  return useThemePreferenceStore((state) => state.value);
}

/** Saves a new preference; the theme applies at once, without reloading. */
export function setThemePreference(preference: ThemePreference): void {
  useThemePreferenceStore.getState().set(preference);
}

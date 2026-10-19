import { useSyncExternalStore } from 'react';
import { resolveTheme } from './resolveTheme';
import { subscribeSystemTheme, systemPrefersDark } from './systemTheme';
import type { ResolvedTheme } from './themeConfig';
import { useThemePreference } from './themeStore';

/** The theme currently rendered: the preference, with "system" following the device live. */
export function useResolvedTheme(): ResolvedTheme {
  const preference = useThemePreference();
  const prefersDark = useSyncExternalStore(subscribeSystemTheme, systemPrefersDark, () => true);
  return resolveTheme(preference, prefersDark);
}

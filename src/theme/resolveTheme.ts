/** Turns the stored preference into the theme to render. */
import type { ResolvedTheme, ThemePreference } from './themeConfig';

/** "system" follows the device appearance; the explicit choices win over it. */
export function resolveTheme(preference: ThemePreference, systemPrefersDark: boolean): ResolvedTheme {
  if (preference === 'system') return systemPrefersDark ? 'dark' : 'light';
  return preference;
}

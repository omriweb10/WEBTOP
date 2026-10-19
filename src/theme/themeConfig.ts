/**
 * Theme configuration: the user-facing choices, the default, where the choice is stored and
 * what each resolved theme sets on the browser chrome. The inline boot script in index.html
 * mirrors these values (kept in sync by tests/unit/theme.test.ts).
 */
export const THEME_PREFERENCES = ['light', 'dark', 'system'] as const;
export type ThemePreference = (typeof THEME_PREFERENCES)[number];
export type ResolvedTheme = 'light' | 'dark';

/** The original appearance stays the default; Light and System are opt-in. */
export const DEFAULT_THEME_PREFERENCE: ThemePreference = 'dark';

export const THEME_STORAGE_KEY = 'webtop-pwa:theme';
export const THEME_ATTRIBUTE = 'data-theme';
export const SYSTEM_DARK_QUERY = '(prefers-color-scheme: dark)';

export interface ThemeChrome {
  /** <meta name="theme-color">: Safari UI and, on iOS, the standalone status bar tint. */
  themeColor: string;
  /** <meta name="color-scheme"> and native form controls. */
  colorScheme: ResolvedTheme;
  /**
   * iOS standalone status bar. Read when the Home Screen app launches: dark keeps the
   * translucent bar over the app's own band; light asks iOS for its light bar with dark text.
   */
  statusBarStyle: 'black-translucent' | 'default';
}

export const THEME_CHROME: Record<ResolvedTheme, ThemeChrome> = {
  dark: { themeColor: '#12161c', colorScheme: 'dark', statusBarStyle: 'black-translucent' },
  light: { themeColor: '#f6f6f6', colorScheme: 'light', statusBarStyle: 'default' },
};

export const THEME_LABELS: Record<ThemePreference, string> = {
  light: 'בהיר',
  dark: 'כהה',
  system: 'לפי המכשיר',
};

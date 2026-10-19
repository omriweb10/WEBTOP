/** The device appearance (prefers-color-scheme), as a subscribable value. */
import { SYSTEM_DARK_QUERY } from './themeConfig';

/** The media query list, or null where matchMedia is unavailable (tests, very old browsers). */
function query(): MediaQueryList | null {
  return typeof window !== 'undefined' && typeof window.matchMedia === 'function' ? window.matchMedia(SYSTEM_DARK_QUERY) : null;
}

/** True when the device is in dark appearance (dark is assumed when unknown). */
export function systemPrefersDark(): boolean {
  return query()?.matches ?? true;
}

/** Calls `onChange` whenever the device appearance changes; returns the unsubscribe. */
export function subscribeSystemTheme(onChange: () => void): () => void {
  const list = query();
  if (!list) return () => undefined;
  list.addEventListener('change', onChange);
  return () => list.removeEventListener('change', onChange);
}

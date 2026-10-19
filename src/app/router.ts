/**
 * Tiny hash router. Hash URLs ("/WEBTOP/#/schedule/events") work on GitHub Pages
 * without server rewrites, survive offline reloads through the service worker, and make
 * every screen deep-linkable.
 */
import { useSyncExternalStore } from 'react';

export const SCHEDULE_TABS = ['changes', 'timetable', 'events'] as const;
export type ScheduleTab = (typeof SCHEDULE_TABS)[number];

export const PLACEHOLDER_IDS = [
  'messages',
  'student-card',
  'signatures',
  'weekly-planning',
  'phone-book',
  'spaces',
  'forms',
  'meetings',
  'school-site',
  'external-sites',
] as const;
export type PlaceholderId = (typeof PLACEHOLDER_IDS)[number];

export const ADMIN_SECTIONS = ['users', 'sessions', 'presets', 'templates', 'content'] as const;
export type AdminSection = (typeof ADMIN_SECTIONS)[number];

export type Route =
  | { name: 'home' }
  | { name: 'schedule'; tab: ScheduleTab }
  | { name: 'settings' }
  | { name: 'tools' }
  | { name: 'admin'; section: AdminSection; id?: string }
  | { name: 'placeholder'; id: PlaceholderId };

export const DEFAULT_ROUTE: Route = { name: 'schedule', tab: 'timetable' };

/** Parses a location hash into a route; unknown paths fall back to the timetable. */
export function parseHash(hash: string): Route {
  const parts = hash.replace(/^#\/?/, '').split('/').filter(Boolean);
  const [first, second, third] = parts;
  switch (first) {
    case 'home':
      return { name: 'home' };
    case 'schedule':
      return SCHEDULE_TABS.includes(second as ScheduleTab)
        ? { name: 'schedule', tab: second as ScheduleTab }
        : DEFAULT_ROUTE;
    case 'settings':
      return { name: 'settings' };
    case 'tools':
      return { name: 'tools' };
    case 'admin': {
      const section = ADMIN_SECTIONS.includes(second as AdminSection) ? (second as AdminSection) : 'users';
      const id = third && /^[0-9a-f-]{36}$/.test(third) ? third : undefined;
      return id ? { name: 'admin', section, id } : { name: 'admin', section };
    }
    case 'page':
      return PLACEHOLDER_IDS.includes(second as PlaceholderId)
        ? { name: 'placeholder', id: second as PlaceholderId }
        : DEFAULT_ROUTE;
    default:
      return DEFAULT_ROUTE;
  }
}

/** Serialises a route to its hash (inverse of parseHash). */
export function routeToHash(route: Route): string {
  switch (route.name) {
    case 'home':
      return '#/home';
    case 'schedule':
      return `#/schedule/${route.tab}`;
    case 'settings':
      return '#/settings';
    case 'tools':
      return '#/tools';
    case 'admin':
      return `#/admin/${route.section}${route.id ? `/${route.id}` : ''}`;
    case 'placeholder':
      return `#/page/${route.id}`;
  }
}

/** True when two routes render the same screen and tab. */
export function sameRoute(a: Route, b: Route): boolean {
  return routeToHash(a) === routeToHash(b);
}

/** Subscribes to hash changes for useSyncExternalStore. */
function subscribe(callback: () => void): () => void {
  window.addEventListener('hashchange', callback);
  return () => window.removeEventListener('hashchange', callback);
}

/** Current route, re-rendering on navigation. */
export function useRoute(): Route {
  const hash = useSyncExternalStore(subscribe, () => window.location.hash, () => '');
  return parseHash(hash);
}

/** Navigates to a route. `replace` avoids stacking history entries (used for tabs). */
export function navigate(route: Route, options: { replace?: boolean } = {}): void {
  const hash = routeToHash(route);
  if (window.location.hash === hash) return;
  if (options.replace) {
    window.history.replaceState(window.history.state, '', hash);
    window.dispatchEvent(new HashChangeEvent('hashchange'));
  } else {
    window.location.hash = hash;
  }
}

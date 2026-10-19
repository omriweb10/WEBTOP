/** Home-screen shortcut tiles: label, icon, tint and destination. */
import type { Route } from '../../app/router';
import type { IconName } from '../../components/ui/icons/iconPaths';
import type { ShortcutId } from '../../schemas/content';

export interface ShortcutInfo {
  label: string;
  icon: IconName;
  tint: string;
  route: Route;
}

export const SHORTCUTS: Record<ShortcutId, ShortcutInfo> = {
  timetable: { label: 'מ. שעות ושינויים', icon: 'tableChart', tint: '#8c6cf2', route: { name: 'schedule', tab: 'timetable' } },
  changes: { label: 'שינויים והודעות', icon: 'notifications', tint: '#f4490c', route: { name: 'schedule', tab: 'changes' } },
  events: { label: 'אירועים ומבחנים', icon: 'event', tint: '#1498fd', route: { name: 'schedule', tab: 'events' } },
  settings: { label: 'הגדרות ואודות', icon: 'settings', tint: '#059f8b', route: { name: 'settings' } },
};

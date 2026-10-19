/**
 * Sidebar menu definition. Items mirror the reference drawer; entries without a local
 * implementation lead to clearly-labelled placeholder screens (never dead buttons).
 */
import type { IconName } from '../components/ui/icons/iconPaths';
import type { PlaceholderId, Route } from './router';

export interface NavItem {
  id: string;
  label: string;
  icon: IconName;
  route: Route;
  /** Routes that should highlight this item as active. */
  matches: (route: Route) => boolean;
}

/** Builds a menu entry for a placeholder screen. */
function placeholderItem(id: PlaceholderId, label: string, icon: IconName): NavItem {
  return {
    id,
    label,
    icon,
    route: { name: 'placeholder', id },
    matches: (route) => route.name === 'placeholder' && route.id === id,
  };
}

export const NAV_ITEMS: readonly NavItem[] = [
  { id: 'home', label: 'ריכוז מידע', icon: 'dashboard', route: { name: 'home' }, matches: (r) => r.name === 'home' },
  placeholderItem('messages', 'תיבת הודעות', 'mail'),
  placeholderItem('student-card', 'כרטיס תלמיד', 'accountBox'),
  placeholderItem('signatures', 'חתימות ואישורים', 'signDocument'),
  {
    id: 'schedule',
    label: 'מ. שעות ושינויים',
    icon: 'tableChart',
    route: { name: 'schedule', tab: 'timetable' },
    matches: (r) => r.name === 'schedule',
  },
  placeholderItem('weekly-planning', 'תכנון שבועי', 'event'),
  placeholderItem('phone-book', 'ספר טלפונים', 'contactPhone'),
  placeholderItem('spaces', 'מרחבים', 'castForEducation'),
  placeholderItem('forms', 'טפסים מקוונים', 'description'),
  placeholderItem('meetings', 'יומן פגישות', 'editCalendar'),
  placeholderItem('school-site', 'אתר בית ספרי', 'language'),
  placeholderItem('external-sites', 'אתרים חיצוניים', 'screenShare'),
  {
    id: 'notifications',
    label: 'התראות',
    icon: 'notifications',
    route: { name: 'schedule', tab: 'changes' },
    matches: () => false,
  },
  {
    id: 'settings',
    label: 'הגדרות ואודות',
    icon: 'settings',
    route: { name: 'settings' },
    matches: (r) => r.name === 'settings' || r.name === 'tools',
  },
];

export const PLACEHOLDER_TITLES: Record<PlaceholderId, string> = {
  messages: 'תיבת הודעות',
  'student-card': 'כרטיס תלמיד',
  signatures: 'חתימות ואישורים',
  'weekly-planning': 'תכנון שבועי',
  'phone-book': 'ספר טלפונים',
  spaces: 'מרחבים',
  forms: 'טפסים מקוונים',
  meetings: 'יומן פגישות',
  'school-site': 'אתר בית ספרי',
  'external-sites': 'אתרים חיצוניים',
};

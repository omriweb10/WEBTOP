/** The Student Card section: its title and the screens it offers (only implemented ones). */
import type { Route, StudentCardSection } from '../../../app/router';
import type { IconName } from '../../../components/ui/icons/iconPaths';

export const STUDENT_CARD_TITLE = 'כרטיס תלמיד';

export interface StudentCardEntry {
  id: StudentCardSection;
  label: string;
  icon: IconName;
  route: Route;
}

export const STUDENT_CARD_ENTRIES: readonly StudentCardEntry[] = [
  { id: 'timetable', label: 'מערכת שעות', icon: 'tableChart', route: { name: 'studentCard', section: 'timetable' } },
];

/** The route of the section itself, where a screen's back arrow leads. */
export const STUDENT_CARD_ROUTE: Route = { name: 'studentCard' };

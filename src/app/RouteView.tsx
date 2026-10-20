import { LocalToolsScreen } from '../features/admin/components/LocalToolsScreen';
import { useCanEditLocalContent } from '../features/admin/editCapabilities';
import { HomeScreen } from '../features/home/components/HomeScreen';
import { PlaceholderScreen } from '../features/placeholders/components/PlaceholderScreen';
import { SettingsScreen } from '../features/settings/components/SettingsScreen';
import { StudentCardScreen } from '../features/studentCard/components/StudentCardScreen';
import { StudentCardTimetableScreen } from '../features/studentCard/components/StudentCardTimetableScreen';
import { useRoute } from './router';
import { ScheduleHubScreen } from './screens/ScheduleHubScreen';

/**
 * Maps the current hash route to its student-facing screen. The local tools need the local
 * edit mode; the admin panel (#/admin) is mounted separately by App.
 */
export function RouteView() {
  const route = useRoute();
  const canUseTools = useCanEditLocalContent();
  switch (route.name) {
    case 'home':
      return <HomeScreen />;
    case 'schedule':
      return <ScheduleHubScreen tab={route.tab} />;
    case 'settings':
    case 'admin':
      return <SettingsScreen />;
    case 'tools':
      return canUseTools ? <LocalToolsScreen /> : <SettingsScreen />;
    case 'studentCard':
      return route.section === 'timetable' ? <StudentCardTimetableScreen /> : <StudentCardScreen />;
    case 'placeholder':
      return <PlaceholderScreen id={route.id} />;
  }
}

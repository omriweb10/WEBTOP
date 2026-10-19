import { AdminScreen } from '../features/admin/components/AdminScreen';
import { useIsEditing } from '../features/admin/editModeStore';
import { HomeScreen } from '../features/home/components/HomeScreen';
import { PlaceholderScreen } from '../features/placeholders/components/PlaceholderScreen';
import { SettingsScreen } from '../features/settings/components/SettingsScreen';
import { useRoute } from './router';
import { ScheduleHubScreen } from './screens/ScheduleHubScreen';

/** Maps the current hash route to its screen. The admin route requires edit mode. */
export function RouteView() {
  const route = useRoute();
  const editing = useIsEditing();
  switch (route.name) {
    case 'home':
      return <HomeScreen />;
    case 'schedule':
      return <ScheduleHubScreen tab={route.tab} />;
    case 'settings':
      return <SettingsScreen />;
    case 'admin':
      return editing ? <AdminScreen /> : <SettingsScreen />;
    case 'placeholder':
      return <PlaceholderScreen id={route.id} />;
  }
}

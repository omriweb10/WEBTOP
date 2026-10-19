import { NavigationTabs } from '../../components/layout/NavigationTabs';
import { ScreenFrame } from '../../components/layout/ScreenFrame';
import { useSevenTapUnlock } from '../../features/admin/hooks/useSevenTapUnlock';
import { EventsHeaderActions } from '../../features/events/components/EventsHeaderActions';
import { EventsTab } from '../../features/events/components/EventsTab';
import { ChangesTab } from '../../features/notices/components/ChangesTab';
import { TimetableHeaderActions } from '../../features/timetable/components/TimetableHeaderActions';
import { TimetableTab } from '../../features/timetable/components/TimetableTab';
import { navigate, type ScheduleTab } from '../router';
import styles from './ScheduleHubScreen.module.css';

const TABS: ReadonlyArray<{ id: ScheduleTab; label: string }> = [
  { id: 'changes', label: 'שינויים והודעות' },
  { id: 'timetable', label: 'מערכת שעות' },
  { id: 'events', label: 'אירועים ומבחנים' },
];

/** "מ. שעות ושינויים": the three-tab hub. Seven taps on its title open the edit-mode prompt. */
export function ScheduleHubScreen({ tab }: { tab: ScheduleTab }) {
  const onTitleTap = useSevenTapUnlock();
  const actions =
    tab === 'timetable' ? <TimetableHeaderActions /> : tab === 'events' ? <EventsHeaderActions /> : undefined;

  return (
    <ScreenFrame title="מ. שעות ושינויים" actions={actions} onTitleTap={onTitleTap}>
      <NavigationTabs
        tabs={TABS}
        active={tab}
        idPrefix="schedule"
        onChange={(next) => navigate({ name: 'schedule', tab: next }, { replace: true })}
      />
      <div
        key={tab}
        id="schedule-panel"
        role="tabpanel"
        aria-labelledby={`schedule-tab-${tab}`}
        className={styles.panel}
      >
        {tab === 'timetable' && <TimetableTab />}
        {tab === 'changes' && <ChangesTab />}
        {tab === 'events' && <EventsTab />}
      </div>
    </ScreenFrame>
  );
}

import { UnderlineSelect } from '../../../components/ui/UnderlineSelect';
import { useProfileStore } from '../../../store/dataStores';
import { DayTimetableView } from './DayTimetableView';

/** "מערכת שעות" tab of the schedule hub: the "תצוגה" panel above the shared day view. */
export function TimetableTab() {
  const className = useProfileStore((state) => state.value.className);
  return (
    <>
      <UnderlineSelect label="תצוגה" value="class" options={[{ value: 'class', label: className }]} onChange={() => undefined} />
      <DayTimetableView />
    </>
  );
}

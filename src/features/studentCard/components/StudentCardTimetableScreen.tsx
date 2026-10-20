import { goBack } from '../../../app/router';
import { ScreenFrame } from '../../../components/layout/ScreenFrame';
import { useSevenTapUnlock } from '../../admin/hooks/useSevenTapUnlock';
import { DayTimetableView } from '../../timetable/components/DayTimetableView';
import { TimetableHeaderActions } from '../../timetable/components/TimetableHeaderActions';
import { STUDENT_CARD_ROUTE, STUDENT_CARD_TITLE } from '../domain/studentCardEntries';
import { StudentNamePanel } from './StudentNamePanel';

/**
 * כרטיס תלמיד → מערכת שעות: back arrow, title (seven taps open edit mode), the change-alert
 * and export icons, the student's name and the shared day view — the same timetable and
 * editing logic as the main timetable screen.
 */
export function StudentCardTimetableScreen() {
  const onTitleTap = useSevenTapUnlock();
  return (
    <ScreenFrame
      title="מערכת שעות"
      back={{ label: `חזרה ל${STUDENT_CARD_TITLE}`, onBack: () => goBack(STUDENT_CARD_ROUTE) }}
      actions={<TimetableHeaderActions />}
      onTitleTap={onTitleTap}
    >
      <StudentNamePanel />
      <DayTimetableView spacedTable />
    </ScreenFrame>
  );
}

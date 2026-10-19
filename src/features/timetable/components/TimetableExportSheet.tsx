import { Button } from '../../../components/ui/Button';
import { Modal } from '../../../components/ui/Modal';
import { buildIcsCalendar } from '../../../services/calendar/ics';
import { saveTextFile } from '../../../services/files/fileTransfer';
import { useProfileStore, useTimetableStore } from '../../../store/dataStores';
import { toast } from '../../../store/uiStore';
import { timetableToIcsEvents } from '../domain/timetableExport';
import styles from './TimetableExportSheet.module.css';

interface TimetableExportSheetProps {
  open: boolean;
  onClose: () => void;
}

/** Export options behind the app-bar "file" icon: calendar file or print / PDF. */
export function TimetableExportSheet({ open, onClose }: TimetableExportSheetProps) {
  const className = useProfileStore((state) => state.value.className);

  /** Shares the weekly timetable as a recurring-events .ics file. */
  const exportCalendar = async () => {
    const timetable = useTimetableStore.getState().value;
    const ics = buildIcsCalendar(`מערכת שעות ${className}`, timetableToIcsEvents(timetable, new Date()));
    const outcome = await saveTextFile('timetable.ics', ics, 'text/calendar');
    if (outcome !== 'cancelled') toast('קובץ לוח השנה נוצר', { tone: 'success' });
    onClose();
  };

  /** Opens the system print sheet with the weekly print layout (Save as PDF on iOS). */
  const print = () => {
    onClose();
    window.setTimeout(() => window.print(), 250);
  };

  return (
    <Modal open={open} title="ייצוא מערכת השעות" onClose={onClose}>
      <div className={styles.options}>
        <Button icon="calendar" block onClick={() => void exportCalendar()}>
          הוספה ללוח השנה (‎.ics)
        </Button>
        <p className={styles.hint}>כל שיעור נוסף כאירוע שבועי חוזר. מתאים ליומן של האייפון.</p>
        <Button icon="description" block onClick={print}>
          הדפסה / שמירה כ‑PDF
        </Button>
        <p className={styles.hint}>מדפיס את כל השבוע בטבלה אחת.</p>
      </div>
    </Modal>
  );
}

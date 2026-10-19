import { Button } from '../../../components/ui/Button';
import { confirm } from '../../../components/ui/confirmStore';
import { toast } from '../../../store/uiStore';
import { RESET_LABELS, resetData, type ResetTarget } from '../dataActions';
import styles from './AdminScreen.module.css';

const TARGETS: readonly ResetTarget[] = ['timetable', 'presets', 'content', 'settings', 'everything'];

/** Reset buttons; every reset requires an explicit confirmation — nothing resets silently. */
export function ResetSection() {
  /** Confirms, then resets the chosen area. */
  const run = async (target: ResetTarget) => {
    const ok = await confirm({
      title: RESET_LABELS[target],
      message:
        target === 'everything'
          ? 'כל הנתונים המקומיים יוחזרו לברירת המחדל (נתוני הדוגמה). מומלץ לייצא גיבוי לפני כן. להמשיך?'
          : 'הפעולה תחזיר את האזור הזה לברירת המחדל. להמשיך?',
      confirmLabel: 'איפוס',
      tone: 'danger',
    });
    if (!ok) return;
    resetData(target);
    toast('האיפוס בוצע', { tone: 'success' });
  };

  return (
    <div className={styles.buttonGrid}>
      {TARGETS.map((target) => (
        <Button key={target} icon="restart" variant="danger" onClick={() => void run(target)}>
          {RESET_LABELS[target]}
        </Button>
      ))}
    </div>
  );
}

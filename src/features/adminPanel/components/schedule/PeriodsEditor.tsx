import { Button } from '../../../../components/ui/Button';
import { DEFAULT_PERIODS } from '../../../../data/periods';
import type { Period } from '../../../../schemas/timetable';
import { normalizeTime, toTwoDigitTime } from '../../../../utils/time';
import { validatePeriods } from '../../../timetable/domain/periods';
import { appendPeriod, MAX_PERIODS, renumber } from '../../domain/scheduleModel';
import styles from './schedule.module.css';

interface PeriodsEditorProps {
  periods: readonly Period[];
  onChange: (next: Period[]) => void;
}

/** Bell schedule: 1–13 periods with editable start and end times. */
export function PeriodsEditor({ periods, onChange }: PeriodsEditorProps) {
  const errors = validatePeriods(periods);

  /** Updates one time of one period. */
  const setTime = (index: number, key: 'start' | 'end', value: string) => {
    if (!value) return;
    onChange(periods.map((p, i) => (i === index ? { ...p, [key]: normalizeTime(value) } : p)));
  };

  return (
    <div>
      <ol className={styles.periods}>
        {periods.map((period, index) => (
          <li key={period.number} className={styles.periodRow}>
            <span className={styles.periodLabel}>שעה {period.number}</span>
            <label className={styles.timeField}>
              <span>התחלה</span>
              <input type="time" value={toTwoDigitTime(period.start)} onChange={(event) => setTime(index, 'start', event.target.value)} />
            </label>
            <label className={styles.timeField}>
              <span>סיום</span>
              <input type="time" value={toTwoDigitTime(period.end)} onChange={(event) => setTime(index, 'end', event.target.value)} />
            </label>
          </li>
        ))}
      </ol>
      {errors.length > 0 && (
        <ul className={styles.errors} role="alert">
          {errors.map((error) => (
            <li key={error}>{error}</li>
          ))}
        </ul>
      )}
      <div className={styles.sheetActions}>
        <Button icon="add" disabled={periods.length >= MAX_PERIODS} onClick={() => onChange(appendPeriod(periods))}>
          הוספת שעה
        </Button>
        <Button icon="delete" disabled={periods.length <= 1} onClick={() => onChange(renumber(periods.slice(0, -1)))}>
          הסרת השעה האחרונה
        </Button>
        <Button icon="restart" onClick={() => onChange(DEFAULT_PERIODS.map((p) => ({ ...p })))}>
          שעות ברירת המחדל
        </Button>
      </div>
    </div>
  );
}

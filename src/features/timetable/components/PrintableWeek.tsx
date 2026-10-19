import { APP_NAME } from '../../../config/branding';
import { useProfileStore, useTimetableStore } from '../../../store/dataStores';
import { DAYS } from '../domain/days';
import { formatPeriodLabel } from '../domain/periods';
import styles from './PrintableWeek.module.css';

/**
 * Whole-week grid that exists only for printing (hidden on screen). Used by the export
 * sheet's "print / save as PDF" option.
 */
export function PrintableWeek() {
  const timetable = useTimetableStore((state) => state.value);
  const className = useProfileStore((state) => state.value.className);
  return (
    <div className={styles.print} aria-hidden="true">
      <h1 className={styles.title}>מערכת שעות · {className}</h1>
      <table className={styles.table}>
        <thead>
          <tr>
            <th>שעה</th>
            {DAYS.map((day) => (
              <th key={day.id}>{day.name}</th>
            ))}
          </tr>
        </thead>
        <tbody>
          {timetable.periods.map((period, index) => (
            <tr key={period.number}>
              <th>{formatPeriodLabel(period)}</th>
              {DAYS.map((day) => {
                const lesson = timetable.days[day.id][index];
                return (
                  <td key={day.id} style={lesson ? { borderInlineStart: `4px solid ${lesson.color}` } : undefined}>
                    {lesson && (
                      <>
                        <strong>{lesson.subject}</strong>
                        {lesson.teacher && <div>{lesson.teacher}</div>}
                        {lesson.room && <div>חדר: {lesson.room}</div>}
                      </>
                    )}
                  </td>
                );
              })}
            </tr>
          ))}
        </tbody>
      </table>
      <p className={styles.footer}>{APP_NAME} · עותק אישי</p>
    </div>
  );
}

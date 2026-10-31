import { cx } from '../../../../utils/classNames';
import styles from './TimetableGrid.module.css';

/** The grid's sticky header row: "שעה/יום" over the times, the day's name over the lessons. */
export function TimetableGridHeader({ dayName }: { dayName: string }) {
  return (
    <div role="row" className={cx(styles.row, styles.header)}>
      <div role="columnheader" className={styles.headCell}>
        שעה/יום
      </div>
      <div role="columnheader" className={styles.headCell}>
        {dayName}
      </div>
    </div>
  );
}

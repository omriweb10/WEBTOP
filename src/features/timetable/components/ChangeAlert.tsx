import { useMemo } from 'react';
import { navigate } from '../../../app/router';
import { Icon } from '../../../components/ui/Icon';
import type { DayId } from '../../../schemas/timetable';
import { useNoticesStore, useSettingsStore } from '../../../store/dataStores';
import { formatIsoDmy } from '../../../utils/dates';
import { changesForDate } from '../../notices/domain/noticeOps';
import { isoDateForDay } from '../domain/weekDates';
import styles from './ChangeAlert.module.css';

/**
 * When change alerts are switched on (bell icon), lists the local "שינויי מערכת"
 * notices dated on the selected day of the current week. Renders nothing otherwise.
 */
export function ChangeAlert({ day }: { day: DayId }) {
  const enabled = useSettingsStore((state) => state.value.changeAlerts);
  const notices = useNoticesStore((state) => state.value);
  const iso = isoDateForDay(day, new Date());
  const changes = useMemo(() => changesForDate(notices, iso), [notices, iso]);

  if (!enabled || changes.length === 0) return null;
  return (
    <button
      type="button"
      className={styles.alert}
      onClick={() => navigate({ name: 'schedule', tab: 'changes' }, { replace: true })}
    >
      <Icon name="notifications" size={20} className={styles.icon} />
      <span className={styles.text}>
        <strong>
          {changes.length === 1 ? 'שינוי אחד' : `${changes.length} שינויים`} במערכת ב־{formatIsoDmy(iso)}
        </strong>
        <span className={styles.titles}>{changes.map((c) => c.title).join(' · ')}</span>
      </span>
      <Icon name="chevronLeft" size={20} />
    </button>
  );
}

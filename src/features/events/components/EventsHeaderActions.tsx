import { useState } from 'react';
import { IconButton } from '../../../components/ui/IconButton';
import { Modal } from '../../../components/ui/Modal';
import { buildIcsCalendar } from '../../../services/calendar/ics';
import { saveTextFile } from '../../../services/files/fileTransfer';
import { useEventsStore, useSettingsStore } from '../../../store/dataStores';
import { toast } from '../../../store/uiStore';
import { cx } from '../../../utils/classNames';
import { eventsToIcsEvents, filterEvents, type EventKindFilter } from '../domain/eventOps';
import { useEventsViewStore } from '../eventsViewStore';
import styles from './EventsHeaderActions.module.css';

const FILTER_OPTIONS: ReadonlyArray<{ value: EventKindFilter; label: string }> = [
  { value: 'all', label: 'הכול' },
  { value: 'exam', label: 'מבחנים' },
  { value: 'event', label: 'אירועים' },
];

/** App-bar icons on the events tab: export (.ics), kind filter, month-view toggle. */
export function EventsHeaderActions() {
  const settings = useSettingsStore((state) => state.value);
  const update = useSettingsStore((state) => state.update);
  const group = useEventsViewStore((state) => state.group);
  const [filterOpen, setFilterOpen] = useState(false);

  /** Exports the currently filtered items to a calendar file. */
  const exportEvents = async () => {
    const items = filterEvents(useEventsStore.getState().value, settings.eventsKindFilter, group);
    if (items.length === 0) {
      toast('אין אירועים או מבחנים לייצוא');
      return;
    }
    const outcome = await saveTextFile('events.ics', buildIcsCalendar('אירועים ומבחנים', eventsToIcsEvents(items)), 'text/calendar');
    if (outcome !== 'cancelled') toast('קובץ לוח השנה נוצר', { tone: 'success' });
  };

  const monthView = settings.eventsView === 'month';
  return (
    <>
      <IconButton icon="fileSave" label="ייצוא ללוח שנה" onClick={() => void exportEvents()} />
      <IconButton
        icon="filter"
        label="סינון לפי סוג"
        aria-pressed={settings.eventsKindFilter !== 'all'}
        onClick={() => setFilterOpen(true)}
      />
      <IconButton
        icon={monthView ? 'list' : 'calendar'}
        label={monthView ? 'תצוגת רשימה' : 'תצוגת לוח חודשי'}
        aria-pressed={monthView}
        onClick={() => update((s) => ({ ...s, eventsView: monthView ? 'list' : 'month' }))}
      />
      <Modal open={filterOpen} title="סינון" onClose={() => setFilterOpen(false)}>
        <div className={styles.options} role="radiogroup" aria-label="סוג פריטים">
          {FILTER_OPTIONS.map((option) => (
            <button
              key={option.value}
              type="button"
              role="radio"
              aria-checked={settings.eventsKindFilter === option.value}
              className={cx(styles.option, settings.eventsKindFilter === option.value && styles.selected)}
              onClick={() => {
                update((s) => ({ ...s, eventsKindFilter: option.value }));
                setFilterOpen(false);
              }}
            >
              {option.label}
            </button>
          ))}
        </div>
      </Modal>
    </>
  );
}

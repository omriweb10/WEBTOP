import { useMemo, useState } from 'react';
import { Button } from '../../../components/ui/Button';
import { confirm } from '../../../components/ui/confirmStore';
import { ItemRow } from '../../../components/ui/ItemRow';
import { EmptyState } from '../../../components/ui/SectionCard';
import { UnderlineSelect } from '../../../components/ui/UnderlineSelect';
import type { EventKind, SchoolEvent } from '../../../schemas/content';
import { useEventsStore, useSettingsStore } from '../../../store/dataStores';
import { formatIsoDmy, fromIsoDate, hebrewMonthLabel } from '../../../utils/dates';
import { useIsEditing } from '../../admin/editModeStore';
import { EVENT_KIND_LABELS, filterEvents, groupEventsByMonth } from '../domain/eventOps';
import { eventActions } from '../eventActions';
import { useEventsViewStore } from '../eventsViewStore';
import { useEventGroups } from '../hooks/useEventGroups';
import { EventEditor } from './EventEditor';
import { EventsMonthView } from './EventsMonthView';
import styles from './EventsTab.module.css';

/** "אירועים ומבחנים" tab: group filter, optional month view, and the chronological list. */
export function EventsTab() {
  const events = useEventsStore((state) => state.value);
  const settings = useSettingsStore((state) => state.value);
  const { group, setGroup, month, shiftMonth, selectedDate, selectDate } = useEventsViewStore();
  const groups = useEventGroups();
  const editing = useIsEditing();
  const [target, setTarget] = useState<{ event: SchoolEvent } | { kind: EventKind } | null>(null);

  const filtered = useMemo(
    () => filterEvents(events, settings.eventsKindFilter, group),
    [events, settings.eventsKindFilter, group],
  );
  const visible = settings.eventsView === 'month' && selectedDate ? filtered.filter((e) => e.date === selectedDate) : filtered;
  const months = groupEventsByMonth(visible);

  /** Confirms and deletes one item. */
  const remove = async (event: SchoolEvent) => {
    if (await confirm({ title: 'מחיקה', message: `למחוק את „${event.title}”?`, confirmLabel: 'מחיקה', tone: 'danger' })) {
      eventActions.remove(event.id);
    }
  };

  return (
    <>
      <UnderlineSelect
        label="כיתות/קבוצות לימוד"
        placeholderStyle
        value={group}
        options={[{ value: '', label: 'כיתות/קבוצות לימוד' }, ...groups.map((g) => ({ value: g, label: g }))]}
        onChange={setGroup}
      />
      <div className={styles.scroll}>
        {settings.eventsView === 'month' && (
          <EventsMonthView
            month={month}
            events={filtered}
            selectedDate={selectedDate}
            onShiftMonth={shiftMonth}
            onSelectDate={selectDate}
          />
        )}
        {settings.eventsKindFilter !== 'all' && (
          <p className={styles.filterNote}>מסונן: {settings.eventsKindFilter === 'exam' ? 'מבחנים בלבד' : 'אירועים בלבד'}</p>
        )}
        {editing && (
          <div className={styles.addRow}>
            <Button icon="add" onClick={() => setTarget({ kind: 'exam' })}>
              מבחן חדש
            </Button>
            <Button icon="add" onClick={() => setTarget({ kind: 'event' })}>
              אירוע חדש
            </Button>
          </div>
        )}
        {months.length === 0 ? (
          <div className={styles.empty}>
            <EmptyState />
          </div>
        ) : (
          months.map(({ month: key, events: items }) => (
            <section key={key} className={styles.month} aria-label={hebrewMonthLabel(fromIsoDate(`${key}-01`))}>
              <h2 className={styles.monthTitle}>{hebrewMonthLabel(fromIsoDate(`${key}-01`))}</h2>
              {items.map((event) => (
                <ItemRow
                  key={event.id}
                  title={event.title}
                  accent={event.kind === 'exam' ? '#f4490c' : '#82b1f2'}
                  meta={[EVENT_KIND_LABELS[event.kind], formatIsoDmy(event.date), event.time, event.group].filter(Boolean).join(' · ')}
                  body={event.notes}
                  onEdit={editing ? () => setTarget({ event }) : undefined}
                  onDelete={editing ? () => void remove(event) : undefined}
                />
              ))}
            </section>
          ))
        )}
      </div>
      {editing && target && <EventEditor target={target} groups={groups} onClose={() => setTarget(null)} />}
    </>
  );
}

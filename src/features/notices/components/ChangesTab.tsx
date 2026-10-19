import { useMemo, useState } from 'react';
import { AddButton } from '../../../components/ui/AddButton';
import { confirm } from '../../../components/ui/confirmStore';
import { ItemRow } from '../../../components/ui/ItemRow';
import { EmptyState, SectionCard } from '../../../components/ui/SectionCard';
import { UnderlineSelect } from '../../../components/ui/UnderlineSelect';
import type { EventKind, Notice, NoticeCategory, SchoolEvent } from '../../../schemas/content';
import { useEventsStore, useNoticesStore, useProfileStore } from '../../../store/dataStores';
import { formatIsoDmy, toIsoDate } from '../../../utils/dates';
import { useCanEditLocalContent } from '../../admin/editCapabilities';
import { EventEditor } from '../../events/components/EventEditor';
import { useEventGroups } from '../../events/hooks/useEventGroups';
import { upcomingEvents } from '../../events/domain/eventOps';
import { eventActions } from '../../events/eventActions';
import { NOTICE_CATEGORY_LABELS, noticesInCategory } from '../domain/noticeOps';
import { noticeActions } from '../noticeActions';
import { NoticeEditor } from './NoticeEditor';
import styles from './ChangesTab.module.css';

const EVENT_SECTIONS: ReadonlyArray<{ kind: EventKind; title: string }> = [
  { kind: 'exam', title: 'מבחנים' },
  { kind: 'event', title: 'אירועים' },
];

/** Asks before deleting an item, then runs the deletion. */
async function confirmDelete(title: string, run: () => void): Promise<void> {
  if (await confirm({ title: 'מחיקה', message: `למחוק את „${title}”?`, confirmLabel: 'מחיקה', tone: 'danger' })) run();
}

/** "שינויים והודעות" tab: general notices, schedule changes, upcoming exams and events. */
export function ChangesTab() {
  const className = useProfileStore((state) => state.value.className);
  const notices = useNoticesStore((state) => state.value);
  const events = useEventsStore((state) => state.value);
  const groups = useEventGroups();
  const editing = useCanEditLocalContent();
  const [noticeTarget, setNoticeTarget] = useState<{ notice: Notice } | { category: NoticeCategory } | null>(null);
  const [eventTarget, setEventTarget] = useState<{ event: SchoolEvent } | { kind: EventKind } | null>(null);
  const upcoming = useMemo(() => upcomingEvents(events, toIsoDate(new Date())), [events]);

  return (
    <>
      <UnderlineSelect label="תצוגה" value="class" options={[{ value: 'class', label: className }]} onChange={() => undefined} />
      <div className={styles.scroll}>
        {(['general', 'change'] as const).map((category) => {
          const items = noticesInCategory(notices, category);
          return (
            <SectionCard
              key={category}
              id={`notices-${category}`}
              title={NOTICE_CATEGORY_LABELS[category]}
              action={editing ? <AddButton label="הוספה" onClick={() => setNoticeTarget({ category })} /> : undefined}
            >
              {items.length === 0 ? (
                <EmptyState />
              ) : (
                items.map((notice) => (
                  <ItemRow
                    key={notice.id}
                    title={notice.title}
                    meta={notice.date ? formatIsoDmy(notice.date) : undefined}
                    body={notice.body}
                    onEdit={editing ? () => setNoticeTarget({ notice }) : undefined}
                    onDelete={editing ? () => void confirmDelete(notice.title, () => noticeActions.remove(notice.id)) : undefined}
                  />
                ))
              )}
            </SectionCard>
          );
        })}
        {EVENT_SECTIONS.map(({ kind, title }) => {
          const items = upcoming.filter((e) => e.kind === kind);
          return (
            <SectionCard
              key={kind}
              id={`events-${kind}`}
              title={title}
              action={editing ? <AddButton label="הוספה" onClick={() => setEventTarget({ kind })} /> : undefined}
            >
              {items.length === 0 ? (
                <EmptyState />
              ) : (
                items.map((event) => (
                  <ItemRow
                    key={event.id}
                    title={event.title}
                    meta={[formatIsoDmy(event.date), event.time, event.group].filter(Boolean).join(' · ')}
                    body={event.notes}
                    onEdit={editing ? () => setEventTarget({ event }) : undefined}
                    onDelete={editing ? () => void confirmDelete(event.title, () => eventActions.remove(event.id)) : undefined}
                  />
                ))
              )}
            </SectionCard>
          );
        })}
      </div>
      {editing && noticeTarget && <NoticeEditor target={noticeTarget} onClose={() => setNoticeTarget(null)} />}
      {editing && eventTarget && <EventEditor target={eventTarget} groups={groups} onClose={() => setEventTarget(null)} />}
    </>
  );
}


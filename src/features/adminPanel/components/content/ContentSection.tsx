import { useEffect, useState } from 'react';
import { Button } from '../../../../components/ui/Button';
import { confirm } from '../../../../components/ui/confirmStore';
import { ItemRow } from '../../../../components/ui/ItemRow';
import { toast } from '../../../../store/uiStore';
import { deleteEvent, deleteNotification, saveEvent, saveNotification } from '../../api/contentApi';
import type { EventRow, NotificationRow } from '../../api/types';
import { errorMessage } from '../../domain/adminErrors';
import { formatDate } from '../../domain/formatters';
import { useEvents, useNotifications, useUsers } from '../../state/resources';
import { Page, Panel } from '../shared/Page';
import { EmptyView, ErrorView, LoadingView } from '../shared/StatusViews';
import { EventForm } from './EventForm';
import { NoticeForm } from './NoticeForm';

type Editing = { kind: 'notice'; row: NotificationRow | null } | { kind: 'event'; row: EventRow | null } | null;

/** Notices and events/exams shown to everyone or to one student. */
export function ContentSection() {
  const notifications = useNotifications();
  const events = useEvents();
  const users = useUsers();
  const [editing, setEditing] = useState<Editing>(null);
  const { load: loadNotifications } = notifications;
  const { load: loadEvents } = events;
  const { load: loadUsers } = users;

  useEffect(() => {
    void loadNotifications();
    void loadEvents();
    void loadUsers();
  }, [loadNotifications, loadEvents, loadUsers]);

  const nameOf = (profileId: string | null) =>
    profileId ? (users.data?.find((u) => u.id === profileId)?.display_name ?? 'משתמש') : 'לכולם';

  /** Deletes after confirmation. */
  const remove = async (title: string, action: () => Promise<void>, reload: () => Promise<void>) => {
    const ok = await confirm({ title: 'מחיקה', message: `למחוק את „${title}”?`, confirmLabel: 'מחיקה', tone: 'danger' });
    if (!ok) return;
    try {
      await action();
      toast('נמחק', { tone: 'success' });
    } catch (error) {
      toast(errorMessage(error), { tone: 'error' });
    } finally {
      void reload();
    }
  };

  /** Wraps a save for the forms (returns an error message or null). */
  const saver = <T,>(save: (input: T) => Promise<void>, reload: (force: boolean) => Promise<void>) => async (input: T) => {
    try {
      await save(input);
      toast('נשמר', { tone: 'success' });
      void reload(true);
      return null;
    } catch (error) {
      return errorMessage(error);
    }
  };

  return (
    <Page title="הודעות ואירועים" subtitle="מוצגים לתלמידים בלשונית „שינויים והודעות” וב„אירועים ומבחנים”.">
      <Panel
        title="הודעות ושינויי מערכת"
        id="admin-notices"
        actions={
          <Button icon="add" onClick={() => setEditing({ kind: 'notice', row: null })}>
            הודעה
          </Button>
        }
      >
        {notifications.status === 'loading' && <LoadingView />}
        {notifications.error && <ErrorView message={notifications.error} onRetry={() => void loadNotifications(true)} />}
        {notifications.data?.length === 0 && <EmptyView text="אין הודעות." />}
        {notifications.data?.map((n) => (
          <ItemRow
            key={n.id}
            title={n.title}
            meta={`${n.category === 'change' ? 'שינוי מערכת' : 'הודעה כללית'} · ${nameOf(n.profile_id)}${n.date ? ` · ${formatDate(n.date)}` : ''}`}
            body={n.body}
            onEdit={() => setEditing({ kind: 'notice', row: n })}
            onDelete={() => void remove(n.title, () => deleteNotification(n.id), () => loadNotifications(true))}
          />
        ))}
      </Panel>
      <Panel
        title="אירועים ומבחנים"
        id="admin-events"
        actions={
          <Button icon="add" onClick={() => setEditing({ kind: 'event', row: null })}>
            אירוע
          </Button>
        }
      >
        {events.status === 'loading' && <LoadingView />}
        {events.error && <ErrorView message={events.error} onRetry={() => void loadEvents(true)} />}
        {events.data?.length === 0 && <EmptyView text="אין אירועים." />}
        {events.data?.map((e) => (
          <ItemRow
            key={e.id}
            title={e.title}
            meta={`${e.kind === 'exam' ? 'מבחן' : 'אירוע'} · ${formatDate(e.date)}${e.time ? ` ${e.time}` : ''} · ${nameOf(e.profile_id)}`}
            body={e.notes}
            onEdit={() => setEditing({ kind: 'event', row: e })}
            onDelete={() => void remove(e.title, () => deleteEvent(e.id), () => loadEvents(true))}
          />
        ))}
      </Panel>

      {editing?.kind === 'notice' && (
        <NoticeForm
          initial={editing.row}
          users={users.data ?? []}
          onClose={() => setEditing(null)}
          onSave={saver((input) => saveNotification(editing.row?.id ?? null, input), loadNotifications)}
        />
      )}
      {editing?.kind === 'event' && (
        <EventForm
          initial={editing.row}
          users={users.data ?? []}
          onClose={() => setEditing(null)}
          onSave={saver((input) => saveEvent(editing.row?.id ?? null, input), loadEvents)}
        />
      )}
    </Page>
  );
}

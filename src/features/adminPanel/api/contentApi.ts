/** Notices and events/exams, for everyone or for one student. */
import { db, unwrap } from './adminClient';
import type { EventRow, NotificationRow } from './types';

export type NotificationInput = Omit<NotificationRow, 'id' | 'created_at'>;
export type EventInput = Omit<EventRow, 'id' | 'created_at'>;

/** All notices, newest first. */
export async function listNotifications(): Promise<NotificationRow[]> {
  return unwrap<NotificationRow[]>(db().from('notifications').select('*').order('created_at', { ascending: false }));
}

/** All events and exams by date. */
export async function listEvents(): Promise<EventRow[]> {
  return unwrap<EventRow[]>(db().from('events').select('*').order('date').order('time'));
}

/** Creates or updates a notice. */
export async function saveNotification(id: string | null, input: NotificationInput): Promise<void> {
  await unwrap(id ? db().from('notifications').update(input).eq('id', id) : db().from('notifications').insert(input));
}

/** Creates or updates an event. */
export async function saveEvent(id: string | null, input: EventInput): Promise<void> {
  await unwrap(id ? db().from('events').update(input).eq('id', id) : db().from('events').insert(input));
}

/** Deletes a notice. */
export async function deleteNotification(id: string): Promise<void> {
  await unwrap(db().from('notifications').delete().eq('id', id));
}

/** Deletes an event. */
export async function deleteEvent(id: string): Promise<void> {
  await unwrap(db().from('events').delete().eq('id', id));
}

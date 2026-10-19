/** Event/exam use-cases (local only). */
import type { SchoolEvent } from '../../schemas/content';
import { useEventsStore } from '../../store/dataStores';
import { removeEvent, upsertEvent } from './domain/eventOps';

export const eventActions = {
  /** Creates or updates an event or exam. */
  save(event: SchoolEvent): void {
    useEventsStore.getState().update((list) => upsertEvent(list, event));
  },
  /** Deletes an event or exam. */
  remove(id: string): void {
    useEventsStore.getState().update((list) => removeEvent(list, id));
  },
};

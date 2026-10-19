/** Notice use-cases (local only). */
import type { Notice } from '../../schemas/content';
import { useNoticesStore } from '../../store/dataStores';
import { removeNotice, upsertNotice } from './domain/noticeOps';

export const noticeActions = {
  /** Creates or updates a notice. */
  save(notice: Notice): void {
    useNoticesStore.getState().update((list) => upsertNotice(list, notice));
  },
  /** Deletes a notice. */
  remove(id: string): void {
    useNoticesStore.getState().update((list) => removeNotice(list, id));
  },
};

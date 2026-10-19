/** Cached admin lists. Mutations call `load(true)` on the lists they affect. */
import { listEvents, listNotifications } from '../api/contentApi';
import { listLibraryPresets } from '../api/presetsApi';
import { listSessions } from '../api/sessionsApi';
import { listTemplates } from '../api/templatesApi';
import { listUsers } from '../api/usersApi';
import { createResource } from './createResource';
import { useUserPresetsStore } from './userPresets';

export const useUsers = createResource(listUsers);
/** The admin's library presets (templates; a source to copy from). Never a student's. */
export const useLibraryPresets = createResource(listLibraryPresets);
export const useTemplates = createResource(listTemplates);
export const useSessions = createResource(listSessions);
export const useNotifications = createResource(listNotifications);
export const useEvents = createResource(listEvents);

/** Reloads everything that shows a student's code/session state. */
export function reloadPeopleViews(): void {
  void useUsers.getState().load(true);
  void useSessions.getState().load(true);
}

/** Drops every cached list (admin signed out). */
export function resetAdminCaches(): void {
  for (const store of [useUsers, useLibraryPresets, useTemplates, useSessions, useNotifications, useEvents]) {
    store.getState().reset();
  }
  useUserPresetsStore.getState().reset();
}

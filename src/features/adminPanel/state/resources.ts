/** Cached admin lists. Mutations call `load(true)` on the lists they affect. */
import { listEvents, listNotifications } from '../api/contentApi';
import { listPresets } from '../api/presetsApi';
import { listSessions } from '../api/sessionsApi';
import { listTemplates } from '../api/templatesApi';
import { listUsers } from '../api/usersApi';
import { createResource } from './createResource';

export const useUsers = createResource(listUsers);
export const usePresets = createResource(listPresets);
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
  for (const store of [useUsers, usePresets, useTemplates, useSessions, useNotifications, useEvents]) {
    store.getState().reset();
  }
}

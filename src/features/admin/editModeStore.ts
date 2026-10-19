/**
 * Edit-mode state. The flag lives in sessionStorage: it survives reloads within the same
 * app session but a cold start always opens in normal viewing mode. Turning it on (seven
 * taps on the title) is a UI shortcut, not authorisation — in account mode the server
 * decides what a student may change, and only in their own timetable.
 */
import { create } from 'zustand';
import { sessionStore } from '../../services/storage/appStorage';
import { EDIT_SESSION_KEY } from '../../services/storage/slices';

interface EditModeState {
  unlocked: boolean;
  /** Shows the editing controls. */
  enable: () => void;
  lock: () => void;
}

export const useEditModeStore = create<EditModeState>()((set) => ({
  unlocked: sessionStore.get(EDIT_SESSION_KEY) === '1',
  enable: () => {
    try {
      sessionStore.set(EDIT_SESSION_KEY, '1');
    } catch {
      /* session persistence is best-effort */
    }
    set({ unlocked: true });
  },
  lock: () => {
    sessionStore.remove(EDIT_SESSION_KEY);
    set({ unlocked: false });
  },
}));

/** Hook returning whether edit controls should be rendered. */
export function useIsEditing(): boolean {
  return useEditModeStore((state) => state.unlocked);
}

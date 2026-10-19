/**
 * Local edit-mode state. The unlock flag lives in sessionStorage: it survives reloads
 * within the same app session but a cold start always opens in normal viewing mode.
 * This gate is a UI convenience only — see domain/editCode.ts.
 */
import { create } from 'zustand';
import { sessionStore } from '../../services/storage/appStorage';
import { EDIT_SESSION_KEY } from '../../services/storage/slices';
import { isEditCodeValid } from './domain/editCode';

interface EditModeState {
  unlocked: boolean;
  /** Prompt for the code is open. */
  promptOpen: boolean;
  openPrompt: () => void;
  closePrompt: () => void;
  /** Unlocks if the code matches; returns whether it did. */
  unlock: (code: string) => boolean;
  lock: () => void;
}

export const useEditModeStore = create<EditModeState>()((set) => ({
  unlocked: sessionStore.get(EDIT_SESSION_KEY) === '1',
  promptOpen: false,
  openPrompt: () => set({ promptOpen: true }),
  closePrompt: () => set({ promptOpen: false }),
  unlock: (code) => {
    if (!isEditCodeValid(code)) return false;
    try {
      sessionStore.set(EDIT_SESSION_KEY, '1');
    } catch {
      /* session persistence is best-effort */
    }
    set({ unlocked: true, promptOpen: false });
    return true;
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

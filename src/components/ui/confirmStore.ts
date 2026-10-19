/**
 * Promise-based confirmation dialogs: `await confirm({...})` resolves true/false.
 * Used for every destructive or bulk action (reset, delete, apply-to-all, import).
 */
import { create } from 'zustand';

export interface ConfirmOptions {
  title: string;
  message: string;
  confirmLabel?: string;
  cancelLabel?: string;
  tone?: 'default' | 'danger';
}

interface ConfirmState {
  request: (ConfirmOptions & { resolve: (ok: boolean) => void }) | null;
  settle: (ok: boolean) => void;
}

export const useConfirmStore = create<ConfirmState>()((set, get) => ({
  request: null,
  settle: (ok) => {
    get().request?.resolve(ok);
    set({ request: null });
  },
}));

/** Opens the confirmation dialog and resolves with the user's choice. */
export function confirm(options: ConfirmOptions): Promise<boolean> {
  // Settle any dialog that is still open so its caller is not left hanging.
  useConfirmStore.getState().request?.resolve(false);
  return new Promise((resolve) => useConfirmStore.setState({ request: { ...options, resolve } }));
}

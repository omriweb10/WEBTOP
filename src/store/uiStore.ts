/** Ephemeral UI state: sidebar visibility and transient toast messages. */
import { create } from 'zustand';
import { createId } from '../utils/id';

export interface Toast {
  id: string;
  message: string;
  tone: 'info' | 'success' | 'error';
  action?: { label: string; run: () => void };
  /** Auto-dismiss delay in ms; 0 keeps it until dismissed. */
  duration: number;
}

interface UiState {
  sidebarOpen: boolean;
  toasts: Toast[];
  setSidebarOpen: (open: boolean) => void;
  showToast: (toast: Omit<Toast, 'id' | 'duration' | 'tone'> & Partial<Pick<Toast, 'duration' | 'tone'>>) => string;
  dismissToast: (id: string) => void;
}

export const useUiStore = create<UiState>()((set) => ({
  sidebarOpen: false,
  toasts: [],
  setSidebarOpen: (open) => set({ sidebarOpen: open }),
  showToast: (toast) => {
    const id = createId('toast');
    set((state) => ({
      // Keep at most three toasts so rapid actions cannot flood the screen.
      toasts: [...state.toasts.slice(-2), { tone: 'info', duration: 3500, ...toast, id }],
    }));
    return id;
  },
  dismissToast: (id) => set((state) => ({ toasts: state.toasts.filter((t) => t.id !== id) })),
}));

/** Convenience wrapper for showing a toast from non-React code. */
export function toast(message: string, options: Partial<Omit<Toast, 'id' | 'message'>> = {}): string {
  return useUiStore.getState().showToast({ message, ...options });
}

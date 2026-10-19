/** Non-persisted events-tab state: group filter, visible month and the selected day. */
import { create } from 'zustand';

interface EventsViewState {
  group: string;
  /** First day of the month shown in the month view. */
  month: Date;
  /** ISO day picked in the month view (filters the list below it), or null. */
  selectedDate: string | null;
  setGroup: (group: string) => void;
  shiftMonth: (delta: number) => void;
  selectDate: (iso: string | null) => void;
}

/** First day of the month containing `date`. */
function monthStart(date: Date): Date {
  return new Date(date.getFullYear(), date.getMonth(), 1);
}

export const useEventsViewStore = create<EventsViewState>()((set) => ({
  group: '',
  month: monthStart(new Date()),
  selectedDate: null,
  setGroup: (group) => set({ group }),
  shiftMonth: (delta) =>
    set((state) => ({ month: new Date(state.month.getFullYear(), state.month.getMonth() + delta, 1), selectedDate: null })),
  selectDate: (iso) => set({ selectedDate: iso }),
}));

/** Non-persisted view state of the timetable (selected day, direction of the last day change). */
import { create } from 'zustand';
import type { DayId } from '../../schemas/timetable';
import { defaultDayForDate } from './domain/days';

interface TimetableViewState {
  day: DayId;
  /** +1 when moving later in the week, -1 when moving earlier; drives the slide animation. */
  direction: 1 | -1 | 0;
  selectDay: (day: DayId) => void;
}

export const useTimetableViewStore = create<TimetableViewState>()((set, get) => ({
  day: defaultDayForDate(new Date()),
  direction: 0,
  selectDay: (day) => {
    const order = ['sun', 'mon', 'tue', 'wed', 'thu'];
    const current = get().day;
    if (day === current) return;
    set({ day, direction: order.indexOf(day) > order.indexOf(current) ? 1 : -1 });
  },
}));

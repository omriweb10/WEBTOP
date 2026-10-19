/**
 * Timetable use-cases invoked by the UI. Each action applies a pure domain operation to
 * the persisted store and records an undo snapshot, so destructive edits can be
 * reverted from the confirmation toast. In account mode a registered listener saves
 * every change (including undo) to the server.
 */
import type { Lesson, Timetable } from '../../schemas/timetable';
import { useTimetableStore } from '../../store/dataStores';
import { toast } from '../../store/uiStore';
import {
  clearSlot,
  copyLesson,
  duplicateToNextPeriod,
  moveLesson,
  setLesson,
  type ConflictMode,
  type Slot,
} from './domain/timetableOps';

const MAX_UNDO = 20;
const undoStack: Timetable[] = [];
let changeListener: (() => void) | null = null;

/** Registers the listener called after every user change (account-mode server sync). */
export function setTimetableChangeListener(listener: (() => void) | null): void {
  changeListener = listener;
}

/** Forgets undo history (when a different account's timetable is loaded). */
export function clearTimetableHistory(): void {
  undoStack.length = 0;
}

/** Applies a pure transformation, recording the previous state for undo when it changed. */
function commit(transform: (timetable: Timetable) => Timetable): boolean {
  const before = useTimetableStore.getState().value;
  const after = transform(before);
  if (after === before) return false;
  undoStack.push(before);
  if (undoStack.length > MAX_UNDO) undoStack.shift();
  useTimetableStore.getState().set(after);
  changeListener?.();
  return true;
}

/** Restores the timetable as it was before the most recent change. */
export function undoTimetableChange(): boolean {
  const previous = undoStack.pop();
  if (!previous) return false;
  useTimetableStore.getState().set(previous);
  changeListener?.();
  return true;
}

/** Shows a toast with an undo button for a change that just happened. */
function announce(message: string): void {
  toast(message, { tone: 'success', action: { label: 'ביטול', run: undoTimetableChange }, duration: 5000 });
}

export const timetableActions = {
  /** Saves a lesson into a slot (create or edit). */
  saveLesson(slot: Slot, lesson: Lesson): void {
    if (commit((tt) => setLesson(tt, slot, lesson))) announce('השיעור נשמר');
  },
  /** Turns a slot into an empty period. */
  clear(slot: Slot): void {
    if (commit((tt) => clearSlot(tt, slot))) announce('השעה סומנה כריקה');
  },
  /** Moves a lesson; `mode` decides what happens to an occupied target. */
  move(from: Slot, to: Slot, mode: ConflictMode): void {
    if (commit((tt) => moveLesson(tt, from, to, mode))) announce(mode === 'swap' ? 'השיעורים הוחלפו' : 'השיעור הועבר');
  },
  /** Copies a lesson to another slot. */
  copy(from: Slot, to: Slot): void {
    if (commit((tt) => copyLesson(tt, from, to))) announce('השיעור הועתק');
  },
  /** Duplicates a lesson into the next period of the same day. */
  duplicateToNext(slot: Slot): void {
    if (commit((tt) => duplicateToNextPeriod(tt, slot))) announce('השיעור שוכפל לשעה הבאה');
  },
  /** Replaces the whole timetable (import / preset propagation), undoable. */
  replace(timetable: Timetable): void {
    commit(() => timetable);
  },
  /** Restores the default example timetable, undoable. */
  resetToDefault(): void {
    const before = useTimetableStore.getState().value;
    undoStack.push(before);
    useTimetableStore.getState().reset();
    changeListener?.();
  },
};

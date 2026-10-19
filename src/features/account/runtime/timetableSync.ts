/**
 * Saves the student's timetable edits to the server. Edits apply locally at once; this
 * module sends the difference from the last server-confirmed timetable, coalescing rapid
 * edits into one batch. If the server refuses or cannot be reached, the timetable returns
 * to the confirmed state so the screen never shows something that was not saved.
 */
import type { Timetable } from '../../../schemas/timetable';
import { isNetworkError, isSessionEndedError } from '../../../services/supabase/errors';
import { usePresetsStore, useTimetableStore } from '../../../store/dataStores';
import { toast } from '../../../store/uiStore';
import { saveMyLessons } from '../api/studentApi';
import { buildTimetable, diffLessons } from '../domain/bundle';

interface SyncCallbacks {
  /** The server no longer accepts this session. */
  onSessionEnded: () => void;
  /** The server state may have moved on (e.g. a preset was unassigned): reload it. */
  onStale: () => void;
}

let confirmed: Timetable | null = null;
let flushing = false;
let dirty = false;
let callbacks: SyncCallbacks | null = null;

/** Starts syncing with the given callbacks. */
export function initTimetableSync(next: SyncCallbacks): void {
  callbacks = next;
}

/** Records the timetable the server just confirmed. */
export function setConfirmedTimetable(timetable: Timetable): void {
  confirmed = timetable;
}

/** True when no local edit is waiting for, or being sent to, the server. */
export function isTimetableSynced(): boolean {
  return !flushing && !dirty && confirmed === useTimetableStore.getState().value;
}

/** Called after every local edit. */
export function queueTimetableSave(): void {
  dirty = true;
  void flush();
}

/** Explains a refused save and restores the confirmed timetable. */
function fail(error: unknown): void {
  dirty = false;
  if (confirmed) useTimetableStore.getState().set(confirmed);
  if (isSessionEndedError(error)) {
    callbacks?.onSessionEnded();
    return;
  }
  const message = String((error as { message?: unknown } | null)?.message ?? '');
  if (isNetworkError(error)) {
    toast('אין חיבור לשרת — השינוי לא נשמר ובוטל.', { tone: 'error', duration: 6000 });
  } else if (/preset_not_assigned|preset_unavailable/.test(message)) {
    toast('המקצוע שנבחר אינו זמין לך עוד. הרשימה עודכנה.', { tone: 'error', duration: 6000 });
    callbacks?.onStale();
  } else {
    toast('השמירה נכשלה והשינוי בוטל. נסו שוב.', { tone: 'error', duration: 6000 });
    callbacks?.onStale();
  }
}

/** Sends pending edits one batch at a time until nothing is left. */
async function flush(): Promise<void> {
  if (flushing) return;
  flushing = true;
  try {
    while (dirty && confirmed) {
      dirty = false;
      const current = useTimetableStore.getState().value;
      const changes = diffLessons(confirmed, current);
      if (changes.length === 0) continue;
      const result = await saveMyLessons(changes);
      if (!result.ok) {
        fail(result.error);
        return;
      }
      const presets = new Map(usePresetsStore.getState().value.map((p) => [p.id, p]));
      confirmed = buildTimetable(current.periods, result.data, presets);
      // Show exactly what the server stored, unless the user has already edited again.
      if (!dirty) useTimetableStore.getState().set(confirmed);
    }
  } catch (error) {
    fail(error);
  } finally {
    flushing = false;
  }
}

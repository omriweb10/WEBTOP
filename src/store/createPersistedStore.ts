/**
 * Factory for a zustand store whose single `value` is loaded from, and written back to,
 * the versioned storage layer. Components never deal with persistence directly.
 */
import { create } from 'zustand';
import { localStore, reportStorageProblem } from '../services/storage/appStorage';
import type { KeyValueStore } from '../services/storage/keyValueStore';
import { loadValue, saveValue, type PersistedValueSpec } from '../services/storage/persistedValue';

export interface PersistedState<T> {
  value: T;
  /** Replaces the value. */
  set: (next: T) => void;
  /** Derives the next value from the current one. */
  update: (fn: (current: T) => T) => void;
  /** Restores the slice defaults. */
  reset: () => void;
}

/** Creates the store, loading synchronously at startup and saving after every change. */
export function createPersistedStore<T>(spec: PersistedValueSpec<T>, backend: KeyValueStore = localStore) {
  const loaded = loadValue(backend, spec);
  if (loaded.status === 'corrupt') {
    reportStorageProblem({
      kind: 'load',
      key: spec.key,
      message: `נתונים שמורים לא נקראו (${loaded.problem ?? 'לא ידוע'}) ונשמר עותק גיבוי. נטענו ברירות המחדל.`,
    });
  }

  const useStore = create<PersistedState<T>>()((set) => ({
    value: loaded.value,
    set: (next) => set({ value: next }),
    update: (fn) => set((state) => ({ value: fn(state.value) })),
    reset: () => set({ value: spec.defaults() }),
  }));

  useStore.subscribe((state, previous) => {
    if (state.value === previous.value) return;
    const result = saveValue(backend, spec, state.value);
    if (!result.ok) reportStorageProblem({ kind: 'save', key: spec.key, message: result.error });
  });

  return useStore;
}

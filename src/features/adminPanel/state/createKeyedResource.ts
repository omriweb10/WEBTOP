/**
 * Like createResource, but one cached entry per key (e.g. each student's own presets), so
 * several panels of the same student share data and a change reloads it everywhere.
 */
import { create } from 'zustand';
import { errorMessage } from '../domain/adminErrors';

export interface KeyedEntry<T> {
  data: T | null;
  status: 'idle' | 'loading' | 'ready' | 'error';
  error: string | null;
}

export interface KeyedResourceState<T> {
  entries: Record<string, KeyedEntry<T>>;
  /** Loads one key if nothing is cached yet (or always with force). */
  load: (key: string, force?: boolean) => Promise<void>;
  /** Reloads the given keys that are cached (others load when first needed). */
  refresh: (keys: readonly string[]) => void;
  /** Forgets every key (admin signed out). */
  reset: () => void;
}

export const IDLE_ENTRY: KeyedEntry<never> = { data: null, status: 'idle', error: null };

/** Creates a keyed resource store for one loader. */
export function createKeyedResource<T>(loader: (key: string) => Promise<T>) {
  const inFlight = new Map<string, Promise<void>>();
  return create<KeyedResourceState<T>>()((set, get) => {
    /** Replaces one key's entry. */
    const put = (key: string, entry: KeyedEntry<T>) => set({ entries: { ...get().entries, [key]: entry } });
    return {
      entries: {},
      load: (key, force = false) => {
        const running = inFlight.get(key);
        if (running) return running;
        const current = get().entries[key] ?? IDLE_ENTRY;
        if (!force && current.status === 'ready') return Promise.resolve();
        put(key, { data: current.data, status: current.data ? 'ready' : 'loading', error: null });
        const request = loader(key)
          .then((data) => put(key, { data, status: 'ready', error: null }))
          .catch((error: unknown) => put(key, { data: get().entries[key]?.data ?? null, status: 'error', error: errorMessage(error) }))
          .finally(() => inFlight.delete(key));
        inFlight.set(key, request);
        return request;
      },
      refresh: (keys) => {
        for (const key of keys) if (get().entries[key]) void get().load(key, true);
      },
      reset: () => set({ entries: {} }),
    };
  });
}

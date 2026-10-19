/**
 * Minimal synchronous key/value abstraction over Web Storage. The rest of the app never
 * touches `localStorage` directly, which keeps persistence swappable and testable and
 * survives browsers where storage access throws (e.g. some private modes).
 */

export interface KeyValueStore {
  get(key: string): string | null;
  /** Throws on quota or access errors so callers can report a failed save. */
  set(key: string, value: string): void;
  remove(key: string): void;
  keys(): string[];
  /** True when backed by real persistent storage (false for the in-memory fallback). */
  readonly persistent: boolean;
}

/** In-memory store used in tests and as a fallback when Web Storage is unavailable. */
export function createMemoryStore(initial: Record<string, string> = {}): KeyValueStore {
  const map = new Map(Object.entries(initial));
  return {
    persistent: false,
    get: (key) => map.get(key) ?? null,
    set: (key, value) => void map.set(key, value),
    remove: (key) => void map.delete(key),
    keys: () => [...map.keys()],
  };
}

/** Wraps a Web Storage area, falling back to memory if it cannot be accessed at all. */
export function createWebStore(resolve: () => Storage): KeyValueStore {
  let storage: Storage;
  try {
    storage = resolve();
    const probe = '__webtop_probe__';
    storage.setItem(probe, probe);
    storage.removeItem(probe);
  } catch {
    return createMemoryStore();
  }
  return {
    persistent: true,
    get: (key) => {
      try {
        return storage.getItem(key);
      } catch {
        return null;
      }
    },
    set: (key, value) => storage.setItem(key, value),
    remove: (key) => {
      try {
        storage.removeItem(key);
      } catch {
        /* ignore: nothing useful to do if removal fails */
      }
    },
    keys: () => {
      try {
        return Array.from({ length: storage.length }, (_, i) => storage.key(i)).filter(
          (k): k is string => k !== null,
        );
      } catch {
        return [];
      }
    },
  };
}

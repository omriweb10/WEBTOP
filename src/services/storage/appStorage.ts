/**
 * App-wide storage instances plus a tiny problem channel so the UI can tell the user
 * when stored data was unreadable (and quarantined) or a save failed.
 */
import { createWebStore, type KeyValueStore } from './keyValueStore';

export type StorageProblem =
  | { kind: 'load'; key: string; message: string }
  | { kind: 'save'; key: string; message: string };

type Listener = (problem: StorageProblem) => void;

const listeners = new Set<Listener>();
const pending: StorageProblem[] = [];

/** Durable store for user data (localStorage). */
export const localStore: KeyValueStore = createWebStore(() => window.localStorage);
/** Per-session store (sessionStorage) for ephemeral state such as the edit-mode unlock. */
export const sessionStore: KeyValueStore = createWebStore(() => window.sessionStorage);

/** Reports a storage problem; buffered until the UI subscribes so startup issues are not lost. */
export function reportStorageProblem(problem: StorageProblem): void {
  console.warn('[storage]', problem.kind, problem.key, problem.message);
  if (listeners.size === 0) pending.push(problem);
  listeners.forEach((listener) => listener(problem));
}

/** Subscribes to storage problems, immediately replaying any buffered ones. */
export function onStorageProblem(listener: Listener): () => void {
  listeners.add(listener);
  pending.splice(0).forEach(listener);
  return () => listeners.delete(listener);
}

/**
 * Asks the browser to keep this origin's storage from automatic eviction.
 * Returns the resulting state, or null when the API is unavailable.
 */
export async function requestPersistentStorage(): Promise<boolean | null> {
  try {
    if (!navigator.storage?.persist) return null;
    if (await navigator.storage.persisted()) return true;
    return await navigator.storage.persist();
  } catch {
    return null;
  }
}

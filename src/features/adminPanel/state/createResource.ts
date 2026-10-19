/**
 * A tiny cache for one admin list (users, presets, …): load once, reload on demand,
 * expose loading/error state. Built on zustand so effects never call React setState.
 */
import { create } from 'zustand';
import { errorMessage } from '../domain/adminErrors';

export interface ResourceState<T> {
  data: T | null;
  status: 'idle' | 'loading' | 'ready' | 'error';
  error: string | null;
  /** Loads if nothing is cached yet (or always with force). */
  load: (force?: boolean) => Promise<void>;
  /** Forgets the cached data (admin signed out). */
  reset: () => void;
}

/** Creates a resource store for one loader. */
export function createResource<T>(loader: () => Promise<T>) {
  let inFlight: Promise<void> | null = null;
  return create<ResourceState<T>>()((set, get) => ({
    data: null,
    status: 'idle',
    error: null,
    load: (force = false) => {
      if (inFlight) return inFlight;
      if (!force && get().status === 'ready') return Promise.resolve();
      set({ status: get().data ? 'ready' : 'loading', error: null });
      inFlight = loader()
        .then((data) => set({ data, status: 'ready', error: null }))
        .catch((error: unknown) => set({ status: 'error', error: errorMessage(error) }))
        .finally(() => {
          inFlight = null;
        });
      return inFlight;
    },
    reset: () => set({ data: null, status: 'idle', error: null }),
  }));
}

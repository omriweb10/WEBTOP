/** Signed URLs for profile pictures, fetched in batches and cached by storage path. */
import { useEffect } from 'react';
import { create } from 'zustand';
import { signAvatarUrls } from '../api/avatarsApi';

interface AvatarUrlState {
  urls: Record<string, string>;
}

const useAvatarUrlStore = create<AvatarUrlState>()(() => ({ urls: {} }));
const pending = new Set<string>();

/** Requests URLs for paths not cached yet (paths are unique per upload, so never stale). */
async function ensure(paths: readonly string[]): Promise<void> {
  const known = useAvatarUrlStore.getState().urls;
  const missing = [...new Set(paths)].filter((p) => !known[p] && !pending.has(p));
  if (missing.length === 0) return;
  missing.forEach((p) => pending.add(p));
  try {
    const urls = await signAvatarUrls(missing);
    useAvatarUrlStore.setState((state) => ({ urls: { ...state.urls, ...urls } }));
  } catch {
    /* pictures are optional: initials are shown instead */
  } finally {
    missing.forEach((p) => pending.delete(p));
  }
}

/** Returns path → URL for the given paths, fetching missing ones in the background. */
export function useAvatarUrls(paths: ReadonlyArray<string | null | undefined>): Record<string, string> {
  const key = paths.filter(Boolean).join('|');
  useEffect(() => {
    if (key) void ensure(key.split('|'));
  }, [key]);
  return useAvatarUrlStore((state) => state.urls);
}

/**
 * Records app launches locally so the sidebar can show "פתיחה קודמת" (previous launch),
 * the local stand-in for the reference's "last login" line. Nothing leaves the device.
 */
import { localStore } from '../storage/appStorage';
import { LAST_OPENED_KEY } from '../storage/slices';

/** Moves the stored launch time to the "previous" slot and stores now. Call once at startup. */
export function recordLaunch(now = new Date()): void {
  try {
    const last = localStore.get(LAST_OPENED_KEY);
    if (last) localStore.set(`${LAST_OPENED_KEY}:previous`, last);
    localStore.set(LAST_OPENED_KEY, now.toISOString());
  } catch {
    /* best-effort only */
  }
}

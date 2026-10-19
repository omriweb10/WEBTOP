/**
 * What the hidden edit mode unlocks, and when it may be turned on. Locally it covers
 * everything on the device; in account mode it only lets a signed-in student arrange their
 * own timetable from the subjects an administrator assigned — it never grants
 * administrative access, and the server enforces ownership on every save.
 */
import { accountMode } from '../../config/backend';
import { useAccountStore, type AccountPhase } from '../account/accountStore';
import { useIsEditing } from './editModeStore';

/** Notices, events, presets, profile and the local tools screen (local mode only). */
export function useCanEditLocalContent(): boolean {
  return useIsEditing() && !accountMode;
}

/**
 * Why edit mode cannot be turned on right now, or null when it can. Account mode needs a
 * session the server has confirmed and a connection to save through; local mode has no
 * accounts (everything stays on the device), so nothing blocks it there.
 */
export function editModeBlocker(isAccountMode: boolean, phase: AccountPhase, offline: boolean): string | null {
  if (!isAccountMode) return null;
  if (phase !== 'signed-in') return 'צריך להתחבר כדי לערוך את מערכת השעות.';
  if (offline) return 'אין חיבור לשרת — אפשר יהיה לערוך כשהחיבור יחזור.';
  return null;
}

/** editModeBlocker for the current app state. */
export function currentEditModeBlocker(): string | null {
  const { phase, offline } = useAccountStore.getState();
  return editModeBlocker(accountMode, phase, offline);
}

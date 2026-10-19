/**
 * What the hidden edit mode unlocks. Locally it covers everything on the device; in
 * account mode it only lets students arrange their own timetable from the subjects an
 * administrator assigned — it never grants administrative access.
 */
import { accountMode } from '../../config/backend';
import { useIsEditing } from './editModeStore';

/** Notices, events, presets, profile and the local tools screen (local mode only). */
export function useCanEditLocalContent(): boolean {
  return useIsEditing() && !accountMode;
}

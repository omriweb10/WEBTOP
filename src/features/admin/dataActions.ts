/**
 * Data-management use-cases for the edit mode: export, validated import, and resets.
 * Import writes only after the whole file has been validated and the user confirmed
 * which parts to replace.
 */
import type { BackupFile, BackupPart } from '../../schemas/backup';
import {
  backupFileName,
  createBackup,
  serializeBackup,
  type ExportScope,
} from '../../services/backup/backupService';
import { saveTextFile, type SaveFileOutcome } from '../../services/files/fileTransfer';
import {
  useEventsStore,
  useNoticesStore,
  usePresetsStore,
  useProfileStore,
  useSettingsStore,
  useTimetableStore,
} from '../../store/dataStores';
import { timetableActions } from '../timetable/timetableActions';

/** Snapshot of every slice in backup shape. */
function currentData() {
  return {
    timetable: useTimetableStore.getState().value,
    presets: usePresetsStore.getState().value,
    profile: useProfileStore.getState().value,
    notices: useNoticesStore.getState().value,
    events: useEventsStore.getState().value,
    settings: useSettingsStore.getState().value,
  };
}

/** Exports the chosen scope as a JSON file via share sheet / download. */
export function exportData(scope: ExportScope, now = new Date()): Promise<SaveFileOutcome> {
  const backup = createBackup(currentData(), scope, __APP_VERSION__, now);
  return saveTextFile(backupFileName(scope, now), serializeBackup(backup), 'application/json');
}

/** Writes the selected, already-validated parts of a backup into the stores. */
export function importBackup(backup: BackupFile, parts: readonly BackupPart[]): void {
  const { data } = backup;
  for (const part of parts) {
    switch (part) {
      case 'timetable':
        if (data.timetable) timetableActions.replace(data.timetable);
        break;
      case 'presets':
        if (data.presets) usePresetsStore.getState().set(data.presets);
        break;
      case 'profile':
        if (data.profile) useProfileStore.getState().set(data.profile);
        break;
      case 'notices':
        if (data.notices) useNoticesStore.getState().set(data.notices);
        break;
      case 'events':
        if (data.events) useEventsStore.getState().set(data.events);
        break;
      case 'settings':
        if (data.settings) useSettingsStore.getState().set(data.settings);
        break;
    }
  }
}

export type ResetTarget = 'timetable' | 'presets' | 'content' | 'settings' | 'everything';

export const RESET_LABELS: Record<ResetTarget, string> = {
  timetable: 'איפוס מערכת השעות לדוגמה',
  presets: 'איפוס תבניות המקצועות',
  content: 'מחיקת כל ההודעות, האירועים והמבחנים',
  settings: 'איפוס הגדרות ופרטי תצוגה',
  everything: 'איפוס כל הנתונים',
};

/** Resets one area to defaults. Callers must confirm with the user first. */
export function resetData(target: ResetTarget): void {
  const all = target === 'everything';
  if (all || target === 'timetable') timetableActions.resetToDefault();
  if (all || target === 'presets') usePresetsStore.getState().reset();
  if (all || target === 'content') {
    useNoticesStore.getState().reset();
    useEventsStore.getState().reset();
  }
  if (all || target === 'settings') {
    useSettingsStore.getState().reset();
    useProfileStore.getState().reset();
  }
}

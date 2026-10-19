/**
 * JSON export/import of user data. Parsing is all-or-nothing: a file is fully validated
 * before anything is written, so an invalid import can never corrupt the current data.
 */
import {
  BACKUP_FORMAT,
  BACKUP_FORMAT_VERSION,
  BACKUP_PARTS,
  BackupFileSchema,
  type BackupData,
  type BackupFile,
  type BackupPart,
} from '../../schemas/backup';
import { describeIssues } from '../storage/persistedValue';

/** Which parts an export contains. */
export type ExportScope = 'all' | 'timetable' | 'presets';

export const EXPORT_SCOPE_PARTS: Record<ExportScope, readonly BackupPart[]> = {
  all: BACKUP_PARTS,
  timetable: ['timetable'],
  presets: ['presets'],
};

export const BACKUP_PART_LABELS: Record<BackupPart, string> = {
  timetable: 'מערכת השעות',
  presets: 'תבניות מקצועות',
  profile: 'פרטי תצוגה',
  notices: 'הודעות',
  events: 'אירועים ומבחנים',
  settings: 'הגדרות',
};

/** Hard cap on import size; real backups are a few dozen KB. */
export const MAX_IMPORT_BYTES = 2 * 1024 * 1024;

/** Builds a backup file object containing only the parts in `scope`. */
export function createBackup(
  data: Required<BackupData>,
  scope: ExportScope,
  appVersion: string,
  now = new Date(),
): BackupFile {
  const parts = EXPORT_SCOPE_PARTS[scope];
  const selected: BackupData = {};
  for (const part of parts) Object.assign(selected, { [part]: data[part] });
  return {
    format: BACKUP_FORMAT,
    formatVersion: BACKUP_FORMAT_VERSION,
    exportedAt: now.toISOString(),
    appVersion,
    data: selected,
  };
}

/** Serialises a backup as pretty JSON (readable and diff-friendly). */
export function serializeBackup(backup: BackupFile): string {
  return `${JSON.stringify(backup, null, 2)}\n`;
}

/** Suggested file name, e.g. "webtop-backup-all-2026-10-19.json". */
export function backupFileName(scope: ExportScope, now = new Date()): string {
  return `webtop-backup-${scope}-${now.toISOString().slice(0, 10)}.json`;
}

export type ParseBackupResult =
  | { ok: true; backup: BackupFile; parts: BackupPart[] }
  | { ok: false; error: string };

/** Parses and fully validates an import file's text. */
export function parseBackup(text: string): ParseBackupResult {
  if (new Blob([text]).size > MAX_IMPORT_BYTES) return { ok: false, error: 'הקובץ גדול מדי (מעל 2MB)' };
  let json: unknown;
  try {
    json = JSON.parse(text);
  } catch {
    return { ok: false, error: 'הקובץ אינו JSON תקין' };
  }
  if (typeof json !== 'object' || json === null || (json as { format?: unknown }).format !== BACKUP_FORMAT) {
    return { ok: false, error: 'הקובץ אינו קובץ גיבוי של האפליקציה' };
  }
  const result = BackupFileSchema.safeParse(json);
  if (!result.success) return { ok: false, error: `הקובץ אינו תקין: ${describeIssues(result.error)}` };
  const parts = BACKUP_PARTS.filter((part) => result.data.data[part] !== undefined);
  return { ok: true, backup: result.data, parts };
}

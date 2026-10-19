/**
 * Export/import file format. Every part is optional so the same format serves full
 * backups, timetable-only files and preset-only files; at least one part is required.
 */
import { z } from 'zod';
import {
  NoticeListSchema,
  ProfileSchema,
  SchoolEventListSchema,
  SettingsSchema,
} from './content';
import { PresetListSchema } from './presets';
import { TimetableSchema } from './timetable';

export const BACKUP_FORMAT = 'webtop-pwa-backup';
export const BACKUP_FORMAT_VERSION = 1;

export const BackupDataSchema = z.object({
  timetable: TimetableSchema.optional(),
  presets: PresetListSchema.optional(),
  profile: ProfileSchema.optional(),
  notices: NoticeListSchema.optional(),
  events: SchoolEventListSchema.optional(),
  settings: SettingsSchema.optional(),
});
export type BackupData = z.infer<typeof BackupDataSchema>;
export type BackupPart = keyof BackupData;
export const BACKUP_PARTS: readonly BackupPart[] = [
  'timetable',
  'presets',
  'profile',
  'notices',
  'events',
  'settings',
];

export const BackupFileSchema = z
  .object({
    format: z.literal(BACKUP_FORMAT),
    formatVersion: z.literal(BACKUP_FORMAT_VERSION),
    exportedAt: z.string().max(40),
    appVersion: z.string().max(40),
    data: BackupDataSchema,
  })
  .refine((file) => BACKUP_PARTS.some((part) => file.data[part] !== undefined), {
    message: 'הקובץ אינו מכיל נתונים לייבוא',
    path: ['data'],
  });
export type BackupFile = z.infer<typeof BackupFileSchema>;

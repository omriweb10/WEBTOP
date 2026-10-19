/**
 * Schemas for the locally stored profile, notices, events/exams and UI settings.
 * None of this is fetched from — or sent to — any official system.
 */
import { z } from 'zod';
import { IdSchema, IsoDateSchema, TimeSchema, textSchema } from './primitives';

export const ProfileSchema = z.object({
  /** Name shown in the sidebar and the home greeting. */
  studentName: textSchema(60),
  /** Secondary line under the sidebar header (role / school), free text. */
  subtitle: textSchema(80),
  /** Display/class name shown in the "תצוגה" selector (e.g. "י' 1"). */
  className: textSchema(30, 1),
});
export type Profile = z.infer<typeof ProfileSchema>;

export const NOTICE_CATEGORIES = ['general', 'change'] as const;
export const NoticeCategorySchema = z.enum(NOTICE_CATEGORIES);
export type NoticeCategory = z.infer<typeof NoticeCategorySchema>;

export const NoticeSchema = z.object({
  id: IdSchema,
  category: NoticeCategorySchema,
  title: textSchema(120, 1),
  body: textSchema(2000),
  /** Day the notice refers to, if any. */
  date: IsoDateSchema.nullable(),
  createdAt: z.string().max(40),
});
export type Notice = z.infer<typeof NoticeSchema>;
export const NoticeListSchema = z.array(NoticeSchema).max(500);

export const EVENT_KINDS = ['exam', 'event'] as const;
export const EventKindSchema = z.enum(EVENT_KINDS);
export type EventKind = z.infer<typeof EventKindSchema>;

export const SchoolEventSchema = z.object({
  id: IdSchema,
  kind: EventKindSchema,
  title: textSchema(120, 1),
  date: IsoDateSchema,
  time: TimeSchema.nullable(),
  /** Class or study group the item belongs to; empty string = whole class. */
  group: textSchema(80),
  notes: textSchema(2000),
});
export type SchoolEvent = z.infer<typeof SchoolEventSchema>;
export const SchoolEventListSchema = z.array(SchoolEventSchema).max(500);

export const SHORTCUT_IDS = ['timetable', 'changes', 'events', 'settings'] as const;
export const ShortcutIdSchema = z.enum(SHORTCUT_IDS);
export type ShortcutId = z.infer<typeof ShortcutIdSchema>;

export const SettingsSchema = z.object({
  /** Whether today's local schedule-change notices are surfaced above the timetable. */
  changeAlerts: z.boolean(),
  shortcuts: z.array(ShortcutIdSchema).max(SHORTCUT_IDS.length),
  eventsView: z.enum(['list', 'month']),
  eventsKindFilter: z.enum(['all', 'exam', 'event']),
});
export type Settings = z.infer<typeof SettingsSchema>;

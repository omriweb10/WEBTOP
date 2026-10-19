/**
 * The student's server snapshot (get_my_bundle): validated on arrival, then mapped onto the
 * app's existing local models so every screen keeps working unchanged in account mode.
 */
import { z } from 'zod';
import type { Notice, Profile, SchoolEvent } from '../../../schemas/content';
import type { Preset } from '../../../schemas/presets';
import { DAY_IDS, DayIdSchema, PeriodSchema, type DayId, type Lesson, type Timetable } from '../../../schemas/timetable';
import { createEmptyTimetable } from '../../timetable/domain/timetableOps';

const ServerPresetSchema = z.object({
  id: z.uuid(),
  name: z.string().min(1).max(80),
  short_name: z.string().max(40),
  teacher: z.string().max(80),
  room: z.string().max(80),
  color: z.string().regex(/^#[0-9a-fA-F]{6}$/),
  notes: z.string().max(300).default(''),
  archived: z.boolean(),
  assigned: z.boolean(),
});
export type ServerPreset = z.infer<typeof ServerPresetSchema>;

export const ServerLessonSchema = z.object({
  day: DayIdSchema,
  period_index: z.number().int().min(0).max(12),
  preset_id: z.uuid(),
});
export type ServerLesson = z.infer<typeof ServerLessonSchema>;
export const ServerLessonListSchema = z.array(ServerLessonSchema).max(65);

export const BundleSchema = z.object({
  profile: z.object({
    id: z.uuid(),
    display_name: z.string().min(1).max(60),
    class_name: z.string().max(30),
    school_name: z.string().max(80),
    bio: z.string().max(300),
    avatar_path: z.string().max(120).nullable(),
  }),
  session: z.object({ session_id: z.uuid(), started_at: z.string().nullable() }).nullable(),
  timetable: z.object({ periods: z.array(PeriodSchema).min(1).max(13) }),
  lessons: ServerLessonListSchema,
  presets: z.array(ServerPresetSchema).max(500),
  events: z
    .array(
      z.object({
        id: z.uuid(),
        kind: z.enum(['exam', 'event']),
        title: z.string().min(1).max(120),
        date: z.string(),
        time: z.string().nullable(),
        group_name: z.string().max(80),
        notes: z.string().max(2000),
      }),
    )
    .max(500),
  notifications: z
    .array(
      z.object({
        id: z.uuid(),
        category: z.enum(['general', 'change']),
        title: z.string().min(1).max(120),
        body: z.string().max(2000),
        date: z.string().nullable(),
        created_at: z.string(),
      }),
    )
    .max(500),
});
export type Bundle = z.infer<typeof BundleSchema>;

/** What the app remembers about the signed-in account (also cached for offline starts). */
export const AccountSummarySchema = z.object({
  profileId: z.uuid(),
  displayName: z.string(),
  className: z.string(),
  schoolName: z.string(),
  bio: z.string(),
  avatarPath: z.string().nullable(),
  sessionStartedAt: z.string().nullable(),
  /** Presets the admin assigned (and has not archived): the only ones the student may place. */
  assignablePresetIds: z.array(z.string()),
});
export type AccountSummary = z.infer<typeof AccountSummarySchema>;

export interface AccountSnapshot {
  summary: AccountSummary;
  profile: Profile;
  timetable: Timetable;
  presets: Preset[];
  notices: Notice[];
  events: SchoolEvent[];
}

/** Server preset → local preset: the card text is the full name, the chip label the short one. */
export function toLocalPreset(preset: ServerPreset): Preset {
  return {
    id: preset.id,
    name: (preset.short_name.trim() || preset.name).slice(0, 40),
    subject: preset.name,
    teacher: preset.teacher,
    room: preset.room,
    color: preset.color.toLowerCase(),
  };
}

/** Stable per-slot lesson id (lessons are addressed by position on the server). */
export function lessonId(day: DayId, index: number): string {
  return `l_${day}_${index}`;
}

/** Builds the local timetable from server periods, lessons and the presets they reference. */
export function buildTimetable(
  periods: Timetable['periods'],
  lessons: readonly ServerLesson[],
  presets: ReadonlyMap<string, Preset>,
): Timetable {
  const timetable = createEmptyTimetable(periods);
  for (const lesson of lessons) {
    const preset = presets.get(lesson.preset_id);
    if (!preset || lesson.period_index >= periods.length) continue;
    const cell: Lesson = {
      id: lessonId(lesson.day, lesson.period_index),
      presetId: preset.id,
      subject: preset.subject,
      teacher: preset.teacher,
      room: preset.room,
      color: preset.color,
    };
    timetable.days[lesson.day][lesson.period_index] = cell;
  }
  return timetable;
}

/** Local profile used by the existing header, sidebar and greeting. */
export function toLocalProfile(summary: AccountSummary): Profile {
  return {
    studentName: summary.displayName,
    subtitle: [summary.className, summary.schoolName].filter(Boolean).join(' · ') || 'חשבון אישי',
    className: summary.className || 'המערכת שלי',
  };
}

/** Maps a validated bundle onto every local slice. */
export function mapBundle(bundle: Bundle): AccountSnapshot {
  const presets = bundle.presets.map(toLocalPreset);
  const byId = new Map(presets.map((p) => [p.id, p]));
  const summary: AccountSummary = {
    profileId: bundle.profile.id,
    displayName: bundle.profile.display_name,
    className: bundle.profile.class_name,
    schoolName: bundle.profile.school_name,
    bio: bundle.profile.bio,
    avatarPath: bundle.profile.avatar_path,
    sessionStartedAt: bundle.session?.started_at ?? null,
    assignablePresetIds: bundle.presets.filter((p) => p.assigned && !p.archived).map((p) => p.id),
  };
  return {
    summary,
    profile: toLocalProfile(summary),
    timetable: buildTimetable(bundle.timetable.periods, bundle.lessons, byId),
    presets,
    notices: bundle.notifications.map((n) => ({
      id: n.id,
      category: n.category,
      title: n.title,
      body: n.body,
      date: n.date,
      createdAt: n.created_at.slice(0, 40),
    })),
    events: bundle.events.map((e) => ({
      id: e.id,
      kind: e.kind,
      title: e.title,
      date: e.date,
      time: e.time,
      group: e.group_name,
      notes: e.notes,
    })),
  };
}

/** One cell write for save_my_lessons. */
export interface LessonChange {
  day: DayId;
  period_index: number;
  preset_id: string | null;
}

/**
 * Cells whose preset differs between two timetables with the same periods. Account-mode
 * lessons always come from a preset; a custom lesson here is a programming error.
 */
export function diffLessons(base: Timetable, next: Timetable): LessonChange[] {
  const changes: LessonChange[] = [];
  for (const day of DAY_IDS) {
    next.periods.forEach((_, index) => {
      const before = base.days[day][index]?.presetId ?? null;
      const lesson = next.days[day][index] ?? null;
      if (lesson && !lesson.presetId) throw new Error('Account timetables only contain preset lessons');
      const after = lesson?.presetId ?? null;
      if (before !== after) changes.push({ day, period_index: index, preset_id: after });
    });
  }
  return changes;
}

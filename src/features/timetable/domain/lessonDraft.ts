/**
 * Editor draft model for one timetable cell. Keeps the "empty period" choice explicit
 * and centralises validation so the editor component holds no business rules.
 */
import type { Preset } from '../../../schemas/presets';
import { LessonSchema, type Lesson } from '../../../schemas/timetable';

export type LessonFields = Pick<Lesson, 'presetId' | 'subject' | 'teacher' | 'room' | 'color'>;
export type LessonDraft = { empty: true } | ({ empty: false } & LessonFields);
export type DraftErrors = Partial<Record<'subject' | 'teacher' | 'room' | 'color', string>>;

export const EMPTY_DRAFT: LessonDraft = { empty: true };

/** Starts a draft from the cell's current lesson (or an empty period). */
export function draftFromLesson(lesson: Lesson | null): LessonDraft {
  if (!lesson) return EMPTY_DRAFT;
  const { presetId, subject, teacher, room, color } = lesson;
  return { empty: false, presetId, subject, teacher, room, color };
}

/** Fills every field from a preset in one step. */
export function draftFromPreset(preset: Preset): LessonDraft {
  return {
    empty: false,
    presetId: preset.id,
    subject: preset.subject,
    teacher: preset.teacher,
    room: preset.room,
    color: preset.color,
  };
}

/** Starts a blank custom lesson (used when an empty cell gets its first field typed). */
export function blankDraft(color: string): LessonDraft {
  return { empty: false, presetId: null, subject: '', teacher: '', room: '', color };
}

/** Validates a non-empty draft against the persisted lesson schema. */
export function validateDraft(draft: LessonDraft): DraftErrors {
  if (draft.empty) return {};
  const result = LessonSchema.safeParse({ ...draft, id: 'draft' });
  if (result.success) return {};
  const errors: DraftErrors = {};
  for (const issue of result.error.issues) {
    const field = issue.path[0];
    if (field === 'subject' || field === 'teacher' || field === 'room' || field === 'color') {
      errors[field] ??= field === 'subject' && issue.code === 'too_small' ? 'יש להזין שם מקצוע' : issue.message;
    }
  }
  return errors;
}

/** Converts a valid draft into a lesson with the given id (null for an empty period). */
export function draftToLesson(draft: LessonDraft, id: string): Lesson | null {
  if (draft.empty) return null;
  return {
    id,
    presetId: draft.presetId,
    subject: draft.subject.trim(),
    teacher: draft.teacher.trim(),
    room: draft.room.trim(),
    color: draft.color.toLowerCase(),
  };
}

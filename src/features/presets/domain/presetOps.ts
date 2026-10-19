/**
 * Pure rules connecting subject presets and lessons.
 *
 * A lesson stores its own resolved subject/teacher/room/colour plus the id of the preset
 * it came from. Editing a lesson field therefore never touches the preset (a "custom
 * override"), and editing a preset only reaches lessons when the user explicitly applies
 * it — in which case fields that were individually customised are preserved unless the
 * user chooses to overwrite them too.
 */
import type { Preset } from '../../../schemas/presets';
import type { Lesson, Timetable } from '../../../schemas/timetable';
import { createId } from '../../../utils/id';
import { findLessonSlots, mapLessons } from '../../timetable/domain/timetableOps';

export const PRESET_FIELDS = ['subject', 'teacher', 'room', 'color'] as const;
export type PresetField = (typeof PRESET_FIELDS)[number];

/** Creates a lesson whose fields are filled from a preset in a single step. */
export function lessonFromPreset(preset: Preset, id: string = createId('lsn')): Lesson {
  return {
    id,
    presetId: preset.id,
    subject: preset.subject,
    teacher: preset.teacher,
    room: preset.room,
    color: preset.color,
  };
}

/** Re-fills an existing lesson from a preset, keeping the lesson's identity. */
export function applyPresetToLesson(lesson: Lesson, preset: Preset): Lesson {
  return lessonFromPreset(preset, lesson.id);
}

/** Lists the fields where a lesson differs from its preset (its custom overrides). */
export function customizedFields(lesson: Lesson, preset: Preset): PresetField[] {
  return PRESET_FIELDS.filter((field) =>
    field === 'color' ? lesson.color.toLowerCase() !== preset.color.toLowerCase() : lesson[field] !== preset[field],
  );
}

/** Number of lessons in the timetable that reference a preset. */
export function countLessonsUsingPreset(timetable: Timetable, presetId: string): number {
  return findLessonSlots(timetable, (lesson) => lesson.presetId === presetId).length;
}

/**
 * Propagates a preset edit to the lessons that use it. Fields still equal to the
 * preset's previous value follow the new value; customised fields are kept unless
 * `overwriteCustom` is true.
 */
export function applyPresetUpdateToLessons(
  timetable: Timetable,
  previous: Preset,
  next: Preset,
  overwriteCustom = false,
): Timetable {
  return mapLessons(timetable, (lesson) => {
    if (lesson.presetId !== previous.id) return lesson;
    const custom = new Set(customizedFields(lesson, previous));
    const updated: Lesson = { ...lesson, presetId: next.id };
    for (const field of PRESET_FIELDS) {
      if (overwriteCustom || !custom.has(field)) updated[field] = next[field];
    }
    return updated;
  });
}

/** Detaches lessons from a deleted preset; their visible content is untouched. */
export function detachPresetFromLessons(timetable: Timetable, presetId: string): Timetable {
  return mapLessons(timetable, (lesson) => (lesson.presetId === presetId ? { ...lesson, presetId: null } : lesson));
}

/** Inserts or replaces a preset by id, keeping list order stable. */
export function upsertPreset(presets: readonly Preset[], preset: Preset): Preset[] {
  const index = presets.findIndex((p) => p.id === preset.id);
  if (index === -1) return [...presets, preset];
  return presets.map((p, i) => (i === index ? preset : p));
}

/** Removes a preset by id. */
export function removePreset(presets: readonly Preset[], presetId: string): Preset[] {
  return presets.filter((p) => p.id !== presetId);
}

/** Finds the preset whose fields exactly match a lesson (used to re-link imported data). */
export function findMatchingPreset(presets: readonly Preset[], lesson: Lesson): Preset | undefined {
  return presets.find((preset) => customizedFields(lesson, preset).length === 0);
}

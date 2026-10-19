/**
 * FICTIONAL example timetable used on first launch so the app is never blank.
 * It is not anyone's real schedule; the arrangement is invented and every teacher/room
 * value comes from the fictional DEFAULT_PRESETS. Users replace it by importing their
 * private backup or editing in the local edit mode.
 */
import type { Timetable } from '../schemas/timetable';
import { createEmptyTimetable, setLesson } from '../features/timetable/domain/timetableOps';
import { lessonFromPreset } from '../features/presets/domain/presetOps';
import type { DayId } from '../schemas/timetable';
import { DEFAULT_PERIODS } from './periods';
import { DEFAULT_PRESETS } from './defaultPresets';

/** Example arrangement: preset ids per period (null = empty period). */
const EXAMPLE_LAYOUT: Record<DayId, ReadonlyArray<string | null>> = {
  sun: ['preset_math', 'preset_math', 'preset_english', 'preset_english', 'preset_bible', 'preset_history'],
  mon: ['preset_homeroom', 'preset_hebrew', 'preset_hebrew', 'preset_chemistry', 'preset_chemistry', 'preset_sign', 'preset_pe'],
  tue: [null, 'preset_robotics', 'preset_robotics', 'preset_math', 'preset_english', 'preset_history'],
  wed: ['preset_bible', 'preset_bible', 'preset_pe', 'preset_math', 'preset_math', 'preset_hebrew', 'preset_english', 'preset_traffic'],
  thu: ['preset_english', 'preset_sign', 'preset_history', 'preset_chemistry', 'preset_robotics', 'preset_homeroom'],
};

/** Builds the example timetable with deterministic lesson ids. */
export function createExampleTimetable(): Timetable {
  let timetable = createEmptyTimetable(DEFAULT_PERIODS);
  for (const [day, layout] of Object.entries(EXAMPLE_LAYOUT) as Array<[DayId, ReadonlyArray<string | null>]>) {
    layout.forEach((presetId, index) => {
      const preset = DEFAULT_PRESETS.find((p) => p.id === presetId);
      if (preset) timetable = setLesson(timetable, { day, index }, lessonFromPreset(preset, `ex_${day}_${index + 1}`));
    });
  }
  return timetable;
}

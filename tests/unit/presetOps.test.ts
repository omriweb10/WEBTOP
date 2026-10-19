import { describe, expect, it } from 'vitest';
import { DEFAULT_PERIODS } from '../../src/data/periods';
import { DEFAULT_PRESETS } from '../../src/data/defaultPresets';
import {
  applyPresetUpdateToLessons,
  countLessonsUsingPreset,
  customizedFields,
  detachPresetFromLessons,
  lessonFromPreset,
  removePreset,
  upsertPreset,
} from '../../src/features/presets/domain/presetOps';
import { createEmptyTimetable, getLesson, setLesson } from '../../src/features/timetable/domain/timetableOps';
import { PresetListSchema, type Preset } from '../../src/schemas/presets';

const preset: Preset = {
  id: 'p_math',
  name: 'מתמטיקה',
  subject: 'מתמטיקה 4',
  teacher: 'מורה א',
  room: '211',
  color: '#1498fd',
};

describe('preset rules', () => {
  it('fills subject, teacher, room and colour from a preset in one step', () => {
    const lesson = lessonFromPreset(preset, 'l1');
    expect(lesson).toEqual({ id: 'l1', presetId: 'p_math', subject: 'מתמטיקה 4', teacher: 'מורה א', room: '211', color: '#1498fd' });
  });

  it('detects custom overrides per field (colour case-insensitive)', () => {
    const lesson = { ...lessonFromPreset(preset, 'l1'), room: '999', color: '#1498FD' };
    expect(customizedFields(lesson, preset)).toEqual(['room']);
  });

  it('propagates preset edits but keeps customised fields', () => {
    let tt = createEmptyTimetable(DEFAULT_PERIODS);
    tt = setLesson(tt, { day: 'sun', index: 0 }, lessonFromPreset(preset, 'a'));
    tt = setLesson(tt, { day: 'sun', index: 1 }, { ...lessonFromPreset(preset, 'b'), room: 'מעבדה' });
    const next = { ...preset, teacher: 'מורה ב', room: '300' };
    const updated = applyPresetUpdateToLessons(tt, preset, next);
    expect(getLesson(updated, { day: 'sun', index: 0 })).toMatchObject({ teacher: 'מורה ב', room: '300' });
    expect(getLesson(updated, { day: 'sun', index: 1 })).toMatchObject({ teacher: 'מורה ב', room: 'מעבדה' });
    const forced = applyPresetUpdateToLessons(tt, preset, next, true);
    expect(getLesson(forced, { day: 'sun', index: 1 })?.room).toBe('300');
  });

  it('does not touch lessons from other presets', () => {
    let tt = createEmptyTimetable(DEFAULT_PERIODS);
    tt = setLesson(tt, { day: 'mon', index: 0 }, { ...lessonFromPreset(preset, 'a'), presetId: 'other' });
    const updated = applyPresetUpdateToLessons(tt, preset, { ...preset, teacher: 'X' });
    expect(getLesson(updated, { day: 'mon', index: 0 })?.teacher).toBe('מורה א');
  });

  it('counts and detaches lessons that use a preset', () => {
    let tt = createEmptyTimetable(DEFAULT_PERIODS);
    tt = setLesson(tt, { day: 'sun', index: 0 }, lessonFromPreset(preset, 'a'));
    tt = setLesson(tt, { day: 'thu', index: 4 }, lessonFromPreset(preset, 'b'));
    expect(countLessonsUsingPreset(tt, 'p_math')).toBe(2);
    const detached = detachPresetFromLessons(tt, 'p_math');
    expect(countLessonsUsingPreset(detached, 'p_math')).toBe(0);
    expect(getLesson(detached, { day: 'sun', index: 0 })?.subject).toBe('מתמטיקה 4');
  });

  it('upserts and removes presets', () => {
    const list = upsertPreset([], preset);
    expect(upsertPreset(list, { ...preset, room: '1' })).toHaveLength(1);
    expect(removePreset(list, 'p_math')).toHaveLength(0);
  });

  it('ships valid default presets with the brief colours and no duplicate ids', () => {
    expect(PresetListSchema.safeParse(DEFAULT_PRESETS).success).toBe(true);
    const colours = Object.fromEntries(DEFAULT_PRESETS.map((p) => [p.id, p.color]));
    expect(colours).toMatchObject({
      preset_english: '#999a9d',
      preset_math: '#1498fd',
      preset_history: '#444cc1',
      preset_hebrew: '#f4490c',
      preset_bible: '#04b9d4',
      preset_sign: '#e50066',
      preset_homeroom: '#ffbe10',
      preset_pe: '#059f8b',
      preset_chemistry: '#92be43',
      preset_biology: '#259e3b',
    });
  });
});

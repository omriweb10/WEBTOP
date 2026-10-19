/** Per-user subjects in the admin panel: pure helpers and the per-student cache. */
import { describe, expect, it, vi } from 'vitest';
import type { PresetRow } from '../../src/features/adminPanel/api/types';
import { toAdminError } from '../../src/features/adminPanel/domain/adminErrors';
import { lessonUsageLabel, presetDetails } from '../../src/features/adminPanel/domain/formatters';
import { COPY_SUFFIX, copyCandidates, defaultCopySelection, duplicateFields, nameKey } from '../../src/features/adminPanel/domain/presetCopy';
import { PRESET_LIMITS, validatePreset } from '../../src/features/adminPanel/domain/presetForm';
import { canConfirmRemoval, lessonsOption, replacementOptions } from '../../src/features/adminPanel/domain/presetRemoval';
import { createKeyedResource } from '../../src/features/adminPanel/state/createKeyedResource';

const A = 'aaaaaaaa-0000-4000-8000-000000000001';
const B = 'bbbbbbbb-0000-4000-8000-000000000002';

let next = 0;
/** A preset row with sensible defaults. */
function preset(fields: Partial<PresetRow>): PresetRow {
  next += 1;
  return {
    id: `00000000-0000-4000-8000-${String(next).padStart(12, '0')}`,
    profile_id: A,
    library_preset_id: null,
    name: 'מתמטיקה',
    short_name: '',
    teacher: '',
    room: '',
    color: '#1498fd',
    notes: '',
    archived_at: null,
    created_at: '',
    updated_at: '',
    lesson_count: 0,
    template_lesson_count: 0,
    ...fields,
  };
}

describe('duplicating a subject', () => {
  it('keeps every detail and marks the name as a copy within the length limit', () => {
    const source = preset({ name: 'מתמטיקה', teacher: 'דניאל', room: '101', color: '#444cc1', notes: 'הקבצה א' });
    expect(duplicateFields(source)).toEqual({ name: `מתמטיקה${COPY_SUFFIX}`, short_name: '', teacher: 'דניאל', room: '101', color: '#444cc1', notes: 'הקבצה א' });
    const long = duplicateFields(preset({ name: 'א'.repeat(PRESET_LIMITS.name) }));
    expect(long.name.length).toBe(PRESET_LIMITS.name);
    expect(long.name.endsWith(COPY_SUFFIX)).toBe(true);
    expect(validatePreset(long)).toEqual({});
  });
});

describe('copying subjects between students', () => {
  it('offers active source subjects and flags names the target already has', () => {
    const source = [
      preset({ name: 'מתמטיקה', teacher: 'מיכאל', profile_id: B }),
      preset({ name: 'כימיה', profile_id: B }),
      preset({ name: 'ישן', profile_id: B, archived_at: '2026-01-01' }),
    ];
    const target = [preset({ name: ' מתמטיקה ', teacher: 'דניאל' }), preset({ name: 'כימיה', archived_at: '2026-01-01' })];
    const candidates = copyCandidates(source, target);
    expect(candidates.map((c) => [c.preset.name, c.existing?.teacher ?? null])).toEqual([
      ['מתמטיקה', 'דניאל'],
      ['כימיה', null],
    ]);
    expect([...defaultCopySelection(candidates)]).toEqual([source[1]?.id]);
  });

  it('compares names ignoring spacing and letter case', () => {
    expect(nameKey('  Biology   Lab ')).toBe(nameKey('biology lab'));
    expect(nameKey('מתמטיקה')).not.toBe(nameKey('מתמטיקה 5'));
  });
});

describe('removing a subject', () => {
  const physics = preset({ name: 'פיזיקה', lesson_count: 3 });
  const list = [physics, preset({ name: 'כימיה' }), preset({ name: 'מוסתר', archived_at: '2026-01-01' }), preset({ name: 'של אחר', profile_id: B })];

  it('offers only the same student\'s other active subjects as replacements', () => {
    expect(replacementOptions(list, physics).map((p) => p.name)).toEqual(['כימיה']);
  });

  it('requires an explicit choice when the subject is placed in lessons', () => {
    expect(canConfirmRemoval(physics, null, '')).toBe(false);
    expect(canConfirmRemoval(physics, 'replace', '')).toBe(false);
    expect(canConfirmRemoval(physics, 'replace', 'x')).toBe(true);
    expect(canConfirmRemoval(physics, 'delete', '')).toBe(true);
    expect(canConfirmRemoval(physics, 'hide', '')).toBe(true);
    expect(canConfirmRemoval(preset({ lesson_count: 0 }), null, '')).toBe(true);
  });

  it('never asks the server to delete lessons unless that was chosen', () => {
    expect(lessonsOption(physics, null, '')).toEqual({ kind: 'none' });
    expect(lessonsOption(physics, 'hide', '')).toEqual({ kind: 'none' });
    expect(lessonsOption(physics, 'replace', 'x')).toEqual({ kind: 'replace', replacementId: 'x' });
    expect(lessonsOption(physics, 'delete', '')).toEqual({ kind: 'delete' });
    expect(lessonsOption(preset({ lesson_count: 0 }), 'delete', '')).toEqual({ kind: 'none' });
  });
});

describe('wording', () => {
  it('describes details and usage', () => {
    expect(presetDetails({ teacher: 'שרה', room: '205' })).toBe('שרה · חדר 205');
    expect(presetDetails({ teacher: '', room: '' })).toBe('ללא מורה וחדר');
    expect(lessonUsageLabel(0)).toBe('לא משובץ');
    expect(lessonUsageLabel(1)).toBe('משובץ בשיעור אחד');
    expect(lessonUsageLabel(4)).toBe('משובץ ב‑4 שיעורים');
  });

  it('explains the new server refusals', () => {
    expect(toAdminError({ message: 'preset_in_use', code: '23503' }).message).toMatch(/בחרו מה לעשות בשיעורים/);
    expect(toAdminError({ message: 'preset_not_assigned', code: '42501' }).message).toMatch(/אינו שייך למשתמש הזה/);
    expect(toAdminError({ message: 'preset_in_template', code: '23503' }).message).toMatch(/משמש בתבנית/);
  });
});

describe('per-student cache', () => {
  it('keeps each student separate, refreshes only cached students and resets', async () => {
    const loader = vi.fn(async (key: string) => [`${key}-${loader.mock.calls.length}`]);
    const store = createKeyedResource(loader);
    await store.getState().load(A);
    await store.getState().load(A);
    expect(loader).toHaveBeenCalledTimes(1);
    expect(store.getState().entries[A]?.data).toEqual([`${A}-1`]);
    expect(store.getState().entries[B]).toBeUndefined();

    store.getState().refresh([A, B]);
    await vi.waitFor(() => expect(store.getState().entries[A]?.data).toEqual([`${A}-2`]));
    expect(store.getState().entries[B]).toBeUndefined();
    expect(loader).toHaveBeenCalledTimes(2);

    store.getState().reset();
    expect(store.getState().entries).toEqual({});
  });

  it('keeps the last data when a reload fails', async () => {
    let fail = false;
    const store = createKeyedResource(async () => {
      if (fail) throw new Error('offline');
      return ['ok'];
    });
    await store.getState().load(A);
    fail = true;
    await store.getState().load(A, true);
    expect(store.getState().entries[A]).toMatchObject({ data: ['ok'], status: 'error' });
  });
});

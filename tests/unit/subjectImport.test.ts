/** "Import subjects from text": parsing, colours, validation, duplicates and the import action. */
import { describe, expect, it, vi } from 'vitest';
import { importSubjects, importSuccessMessage, PartialImportError, type ImportApi } from '../../src/features/adminPanel/actions/importSubjects';
import type { PresetRow } from '../../src/features/adminPanel/api/types';
import { COLOR_NAMES, normalizeColor } from '../../src/features/adminPanel/domain/subjectImport/colorNames';
import { countPlan, planImport } from '../../src/features/adminPanel/domain/subjectImport/importPlan';
import { parseSubjectText } from '../../src/features/adminPanel/domain/subjectImport/parseSubjects';
import { normalizeText, splitBlocks } from '../../src/features/adminPanel/domain/subjectImport/textBlocks';

const EXAMPLE = `מקצוע : מתמטיקה
שם מורה : ישראל כהן
חדר : 201
צבע : #1498FD

מקצוע : אנגלית
שם מורה : דנה לוי
חדר : 104
צבע : #999A9D

מקצוע : היסטוריה
שם מורה : משה לוי
חדר : 203
צבע : #444CC1`;

const STUDENT = 'aaaaaaaa-0000-4000-8000-000000000001';

let seq = 0;
/** An existing preset of the student. */
function existing(fields: Partial<PresetRow>): PresetRow {
  seq += 1;
  return {
    id: `00000000-0000-4000-8000-${String(seq).padStart(12, '0')}`,
    profile_id: STUDENT,
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

describe('parsing the pasted text', () => {
  it('imports a single subject', () => {
    const result = parseSubjectText('מקצוע : כימיה\nשם מורה : רחל\nחדר : מעבדה 2\nצבע : #92BE43');
    expect(result.issues).toEqual([]);
    expect(result.subjects).toEqual([
      { number: 1, fields: { name: 'כימיה', short_name: '', teacher: 'רחל', room: 'מעבדה 2', color: '#92be43', notes: '' } },
    ]);
  });

  it('imports several subjects separated by empty lines, with HEX colours normalised', () => {
    const result = parseSubjectText(EXAMPLE);
    expect(result.blockCount).toBe(3);
    expect(result.issues).toEqual([]);
    expect(result.subjects.map((s) => [s.fields.name, s.fields.teacher, s.fields.room, s.fields.color])).toEqual([
      ['מתמטיקה', 'ישראל כהן', '201', '#1498fd'],
      ['אנגלית', 'דנה לוי', '104', '#999a9d'],
      ['היסטוריה', 'משה לוי', '203', '#444cc1'],
    ]);
  });

  it('accepts spacing, Windows/old-Mac line endings, tabs, direction marks and field-name variants', () => {
    const messy = [
      '\ufeff\u200fמקצוע:פיזיקה  ',
      'שם  המורה\t:   אבי   כהן',
      'חדר  :  12',
      'צבע : #abc',
      '   ',
      '',
      'מקצוע ：ביולוגיה',
      'שם-מורה : נועה',
      'מספר חדר : 7',
      'צבע: ירוקה',
    ].join('\r\n');
    const result = parseSubjectText(messy.replace('ביולוגיה\r\n', 'ביולוגיה\r'));
    expect(result.issues).toEqual([]);
    expect(result.subjects.map((s) => s.fields)).toEqual([
      { name: 'פיזיקה', short_name: '', teacher: 'אבי כהן', room: '12', color: '#aabbcc', notes: '' },
      { name: 'ביולוגיה', short_name: '', teacher: 'נועה', room: '7', color: '#259e3b', notes: '' },
    ]);
  });

  it('allows an empty teacher or room when the field line is there', () => {
    const result = parseSubjectText('מקצוע : חינוך גופני\nשם מורה : דן\nחדר :\nצבע : טורקיז');
    expect(result.issues).toEqual([]);
    expect(result.subjects[0]?.fields).toMatchObject({ room: '', color: '#04b9d4' });
  });

  it('reports missing fields per subject and imports nothing from that subject', () => {
    const result = parseSubjectText('מקצוע : מתמטיקה\nשם מורה : ישראל\nצבע : כחול\n\nמקצוע : אנגלית\nשם מורה : דנה\nחדר : 104');
    expect(result.subjects).toEqual([]);
    expect(result.issues.map((i) => [i.subject, i.subjectName, i.field, i.message])).toEqual([
      [1, 'מתמטיקה', 'room', 'חסר השדה „חדר”.'],
      [2, 'אנגלית', 'color', 'חסר השדה „צבע”.'],
    ]);
  });

  it('reports invalid colours, unknown fields, malformed lines, repeated fields and empty names', () => {
    const text = [
      'מקצוע : מתמטיקה\nשם מורה : א\nחדר : 1\nצבע : #12345',
      'מקצוע : אנגלית\nשם מורה : ב\nחדר : 2\nצבע : זהב',
      'מקצוע : היסטוריה\nמורה : ג\nקומה : 3\nחדר : 3\nצבע : אדום',
      'מקצוע : לשון\nשם מורה ד\nחדר : 4\nצבע : כתום',
      'מקצוע : תנ"ך\nשם מורה : ה\nשם מורה : ו\nחדר : 5\nצבע : סגול',
      'מקצוע :\nשם מורה : ז\nחדר : 6\nצבע : אפור',
    ].join('\n\n');
    const result = parseSubjectText(text);
    expect(result.subjects).toEqual([]);
    const bySubject = (n: number) => result.issues.filter((i) => i.subject === n).map((i) => i.message);
    expect(bySubject(1).join(' ')).toMatch(/הצבע „#12345” אינו מוכר/);
    expect(bySubject(2).join(' ')).toMatch(/הצבע „זהב” אינו מוכר/);
    expect(bySubject(3).join(' ')).toMatch(/שדה לא מוכר „קומה” בשורה 13/);
    expect(bySubject(4).join(' ')).toMatch(/שורה 18 אינה בפורמט/);
    expect(bySubject(4).join(' ')).toMatch(/חסר השדה „שם מורה”/);
    expect(bySubject(5).join(' ')).toMatch(/השדה „שם מורה” מופיע פעמיים/);
    expect(bySubject(6).join(' ')).toMatch(/שם המקצוע ריק/);
  });

  it('reports the same subject pasted twice instead of guessing', () => {
    const block = 'מקצוע : מתמטיקה\nשם מורה : א\nחדר : 1\nצבע : כחול';
    const result = parseSubjectText(`${block}\n\n${block.replace('מתמטיקה', ' מתמטיקה ')}`);
    expect(result.subjects).toHaveLength(1);
    expect(result.issues).toEqual([expect.objectContaining({ subject: 2, message: 'המקצוע מופיע בטקסט יותר מפעם אחת (גם כמקצוע 1).' })]);
  });

  it('finds nothing in empty or blank text', () => {
    expect(parseSubjectText('')).toEqual({ blockCount: 0, subjects: [], issues: [] });
    expect(parseSubjectText(' \n\r\n\t\n')).toEqual({ blockCount: 0, subjects: [], issues: [] });
  });

  it('keeps line numbers across blocks and line endings', () => {
    expect(normalizeText('a\r\nb\rc\n')).toBe('a\nb\nc\n');
    expect(splitBlocks('א : 1\r\n\r\n\r\nב : 2\nג : 3').map((b) => [b.number, b.lines.map((l) => l.lineNumber)])).toEqual([
      [1, [1]],
      [2, [4, 5]],
    ]);
  });
});

describe('colours', () => {
  it('normalises HEX values', () => {
    expect(normalizeColor('#1498FD')).toBe('#1498fd');
    expect(normalizeColor(' 1498fd ')).toBe('#1498fd');
    expect(normalizeColor('#Fa0')).toBe('#ffaa00');
    expect(normalizeColor('fa0')).toBeNull();
    expect(normalizeColor('#1498F')).toBeNull();
    expect(normalizeColor('')).toBeNull();
  });

  it('maps Hebrew colour names (both forms) to fixed HEX values', () => {
    for (const name of ['כחול', 'אדום', 'ירוק', 'צהוב', 'כתום', 'סגול', 'אפור', 'ורוד', 'טורקיז']) {
      expect(normalizeColor(name), name).toMatch(/^#[0-9a-f]{6}$/);
    }
    expect(normalizeColor('כחול')).toBe('#1498fd');
    expect(normalizeColor('כחולה')).toBe('#1498fd');
    expect(normalizeColor('ורודה.')).toBe(normalizeColor('ורוד'));
    expect(new Set(['כחול', 'אדום', 'ירוק', 'צהוב', 'כתום', 'סגול', 'אפור', 'ורוד', 'טורקיז'].map(normalizeColor)).size).toBe(9);
    for (const hex of COLOR_NAMES.values()) expect(hex).toMatch(/^#[0-9a-f]{6}$/);
  });
});

describe('duplicates', () => {
  const parsed = parseSubjectText(EXAMPLE).subjects;

  it('creates new subjects, skips identical ones and flags changed or hidden ones', () => {
    const plan = planImport(parsed, [
      existing({ name: 'מתמטיקה', teacher: 'ישראל כהן', room: '201', color: '#1498FD' }),
      existing({ name: ' אנגלית', teacher: 'מורה אחרת', room: '104', color: '#999a9d' }),
      existing({ name: 'כימיה' }),
    ]);
    expect(plan.map((p) => [p.subject.fields.name, p.kind])).toEqual([
      ['מתמטיקה', 'identical'],
      ['אנגלית', 'conflict'],
      ['היסטוריה', 'create'],
    ]);
    expect(plan[1]?.changes).toEqual([{ label: 'מורה', from: 'מורה אחרת', to: 'דנה לוי' }]);
    expect(countPlan(plan, false)).toEqual({ create: 1, skip: 2, update: 0 });
    expect(countPlan(plan, true)).toEqual({ create: 1, skip: 1, update: 1 });
  });

  it('treats a hidden subject with the same details as a conflict (updating restores it)', () => {
    const plan = planImport(parsed.slice(0, 1), [existing({ name: 'מתמטיקה', teacher: 'ישראל כהן', room: '201', archived_at: '2026-01-01' })]);
    expect(plan[0]?.kind).toBe('conflict');
    expect(plan[0]?.changes).toEqual([{ label: 'מצב', from: 'מוסתר', to: 'זמין לבחירה' }]);
  });

  it('prefers an active subject when the name exists more than once', () => {
    const hidden = existing({ name: 'אנגלית', archived_at: '2026-01-01' });
    const active = existing({ name: 'אנגלית', teacher: 'ישנה' });
    expect(planImport(parsed.slice(1, 2), [hidden, active])[0]?.existing?.id).toBe(active.id);
  });
});

describe('the import action', () => {
  /** A fake API that records calls. */
  function fakeApi(failUpdateOf?: string): ImportApi & { calls: unknown[] } {
    const calls: unknown[] = [];
    return {
      calls,
      createPresets: vi.fn(async (profileId, list) => {
        calls.push(['create', profileId, list.map((fields: { name: string }) => fields.name)]);
      }),
      replacePresetDetails: vi.fn(async (id, fields) => {
        if (fields.name === failUpdateOf) throw new Error('network');
        calls.push(['update', id, fields]);
      }),
    };
  }

  const english = existing({ name: 'אנגלית', teacher: 'ישנה' });
  const plan = planImport(parseSubjectText(EXAMPLE).subjects, [existing({ name: 'מתמטיקה', teacher: 'ישראל כהן', room: '201' }), english]);

  it('creates the new subjects for the selected student only, in one call, and skips the rest', async () => {
    const api = fakeApi();
    const outcome = await importSubjects(STUDENT, plan, false, api);
    expect(outcome).toEqual({ created: 1, updated: 0, skipped: 2 });
    expect(api.calls).toEqual([['create', STUDENT, ['היסטוריה']]]);
    expect(importSuccessMessage(outcome)).toBe('מקצוע אחד נוסף בהצלחה.');
  });

  it('updates matching subjects only when the admin chose to', async () => {
    const api = fakeApi();
    const outcome = await importSubjects(STUDENT, plan, true, api);
    expect(outcome).toEqual({ created: 1, updated: 1, skipped: 1 });
    expect(api.calls[1]).toEqual(['update', english.id, { name: 'אנגלית', teacher: 'דנה לוי', room: '104', color: '#999a9d' }]);
    expect(importSuccessMessage(outcome)).toBe('מקצוע אחד נוסף בהצלחה. מקצוע אחד עודכן.');
    expect(importSuccessMessage({ created: 5, updated: 0, skipped: 0 })).toBe('5 מקצועות נוספו בהצלחה.');
  });

  it('reports exactly what was done when an approved update fails', async () => {
    const failing = importSubjects(STUDENT, plan, true, fakeApi('אנגלית'));
    await expect(failing).rejects.toBeInstanceOf(PartialImportError);
    await expect(importSubjects(STUDENT, plan, true, fakeApi('אנגלית'))).rejects.toThrow(/נוספו 1 מקצועות ועודכנו 0, אבל עדכון „אנגלית” נכשל/);
  });
});

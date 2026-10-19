import { describe, expect, it } from 'vitest';
import { parseHash, routeToHash } from '../../src/app/router';
import { DEFAULT_PERIODS } from '../../src/data/periods';
import type { PresetRow, UserOverview } from '../../src/features/adminPanel/api/types';
import { toAdminError } from '../../src/features/adminPanel/domain/adminErrors';
import { clampCrop, sourceRect, validateAvatarFile } from '../../src/features/adminPanel/domain/avatarCrop';
import { formatRelative } from '../../src/features/adminPanel/domain/formatters';
import { validatePreset } from '../../src/features/adminPanel/domain/presetForm';
import { validateProfile } from '../../src/features/adminPanel/domain/profileForm';
import {
  appendPeriod,
  lessonsLostByResize,
  presetMap,
  rowsFromTimetable,
  timetableFromRows,
  withPeriods,
} from '../../src/features/adminPanel/domain/scheduleModel';
import { connectionState, filterUsers, userCounts } from '../../src/features/adminPanel/domain/userFilters';

const ID = '0b0f5c2e-7f1a-4f6e-9d55-0c1d2e3f4a5b';

/** A user row with sensible defaults. */
function user(fields: Partial<UserOverview>): UserOverview {
  return {
    id: ID,
    display_name: 'נועה',
    class_name: "י' 2",
    school_name: '',
    bio: '',
    avatar_path: null,
    status: 'active',
    created_at: '',
    updated_at: '',
    code_id: 'c',
    code_hint: 'AB',
    strength_bits: 60,
    code_created_at: null,
    code_last_used_at: null,
    session_id: null,
    session_status: null,
    session_started_at: null,
    session_last_seen_at: null,
    session_device: null,
    source_template_id: null,
    timetable_customized: false,
    ...fields,
  };
}

const PRESET: PresetRow = {
  id: ID,
  name: 'כימיה',
  short_name: '',
  teacher: 'מורה',
  room: '110',
  color: '#92BE43',
  notes: '',
  archived_at: null,
  created_at: '',
  updated_at: '',
};

describe('admin routes', () => {
  it('round-trips sections and user ids', () => {
    expect(parseHash('#/admin')).toEqual({ name: 'admin', section: 'users' });
    expect(parseHash(`#/admin/users/${ID}`)).toEqual({ name: 'admin', section: 'users', id: ID });
    expect(parseHash('#/admin/sessions/not-an-id')).toEqual({ name: 'admin', section: 'sessions' });
    expect(routeToHash({ name: 'admin', section: 'templates' })).toBe('#/admin/templates');
    expect(parseHash('#/tools')).toEqual({ name: 'tools' });
  });
});

describe('user lists', () => {
  it('searches Hebrew text forgivingly and filters by state', () => {
    const users = [user({ display_name: 'נוֹעָה כהן' }), user({ id: 'x', display_name: 'דן', code_id: null, status: 'disabled', session_id: 's' })];
    expect(filterUsers(users, 'נועה', 'all')).toHaveLength(1);
    expect(filterUsers(users, '', 'no-code').map((u) => u.display_name)).toEqual(['דן']);
    expect(filterUsers(users, '', 'connected')).toHaveLength(1);
    expect(userCounts(users)).toEqual({ all: 2, connected: 1, 'no-code': 1, disabled: 1 });
  });

  it('separates signed-in from active-right-now', () => {
    const now = Date.parse('2026-10-19T12:00:00Z');
    expect(connectionState(null, false, now)).toBe('signed-out');
    expect(connectionState('2026-10-19T11:59:00Z', true, now)).toBe('active-now');
    expect(connectionState('2026-10-18T11:59:00Z', true, now)).toBe('signed-in');
    expect(formatRelative('2026-10-19T11:30:00Z', now)).toBe('לפני 30 דקות');
  });
});

describe('admin forms', () => {
  it('mirror the database limits', () => {
    expect(validateProfile({ display_name: ' ', class_name: '', school_name: '', bio: '' })).toHaveProperty('display_name');
    expect(validateProfile({ display_name: 'א', class_name: 'x'.repeat(31), school_name: '', bio: '' })).toHaveProperty('class_name');
    expect(validateProfile({ display_name: 'א', class_name: '', school_name: '', bio: '' })).toEqual({});
    expect(validatePreset({ name: 'x', short_name: '', teacher: '', room: '', color: 'green', notes: '' })).toHaveProperty('color');
    expect(validatePreset({ name: 'x', short_name: '', teacher: '', room: '', color: '#ABCDEF', notes: '' })).toEqual({});
  });

  it('translates backend errors', () => {
    expect(toAdminError({ code: '23503', message: 'update or delete violates foreign key' }).message).toMatch(/ארכיון/);
    expect(toAdminError({ message: 'code_taken' }).message).toMatch(/בשימוש/);
    expect(toAdminError({ message: 'TypeError: Failed to fetch' }).code).toBe('network');
  });
});

describe('avatar crop', () => {
  it('keeps the frame covered and maps the view back to image pixels', () => {
    const clamped = clampCrop({ zoom: 9, offsetX: 5000, offsetY: -5000 }, 1000, 500, 200);
    expect(clamped.zoom).toBe(4);
    // Dragging the image right/up reveals its left/bottom edge.
    const rect = sourceRect(clamped, 1000, 500, 200);
    expect(rect.x).toBeCloseTo(0);
    expect(rect.y + rect.size).toBeCloseTo(500);
    expect(sourceRect({ zoom: 1, offsetX: 0, offsetY: 0 }, 1000, 500, 200)).toEqual({ x: 250, y: 0, size: 500 });
  });

  it('accepts only small JPG/PNG/WebP files', () => {
    expect(validateAvatarFile({ type: 'image/gif', size: 10 })).not.toBeNull();
    expect(validateAvatarFile({ type: 'image/png', size: 16 * 1024 * 1024 })).not.toBeNull();
    expect(validateAvatarFile({ type: 'image/webp', size: 1000 })).toBeNull();
  });
});

describe('schedule model', () => {
  it('round-trips lesson rows and resizes periods safely', () => {
    const map = presetMap([PRESET]);
    const rows = [{ day: 'tue' as const, period_index: 12, preset_id: ID }, { day: 'sun' as const, period_index: 0, preset_id: ID }];
    const timetable = timetableFromRows(DEFAULT_PERIODS, rows, map);
    expect(timetable.days.tue[12]).toMatchObject({ subject: 'כימיה', color: '#92be43' });
    expect(rowsFromTimetable(timetable)).toEqual([rows[1], rows[0]]);
    expect(lessonsLostByResize(timetable, 10)).toBe(1);
    const shorter = withPeriods(timetable, DEFAULT_PERIODS.slice(0, 10));
    expect(shorter.days.tue).toHaveLength(10);
    expect(rowsFromTimetable(shorter)).toEqual([rows[1]]);
  });

  it('appends periods after the last one, up to 13', () => {
    const two = appendPeriod([{ number: 1, start: '8:00', end: '8:45' }]);
    expect(two[1]).toEqual({ number: 2, start: '8:50', end: '9:35' });
    expect(appendPeriod(DEFAULT_PERIODS)).toHaveLength(13);
  });
});

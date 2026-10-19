import { describe, expect, it } from 'vitest';
import { parseBackendConfig } from '../../src/config/backend';
import { BundleSchema, diffLessons, lessonId, mapBundle, type Bundle } from '../../src/features/account/domain/bundle';
import { describeDevice } from '../../src/features/account/domain/deviceLabel';
import { loginFailureFromResponse, loginFailureMessage } from '../../src/features/account/domain/loginMessages';
import { setLesson } from '../../src/features/timetable/domain/timetableOps';
import { isNetworkError, isSessionEndedError } from '../../src/services/supabase/errors';

const P1 = '11111111-1111-4111-8111-111111111111';
const P2 = '22222222-2222-4222-8222-222222222222';
const PROFILE = '33333333-3333-4333-8333-333333333333';

/** A minimal valid server bundle. */
function bundle(overrides: Partial<Bundle> = {}): Bundle {
  return BundleSchema.parse({
    profile: { id: PROFILE, display_name: 'דנה', class_name: "י' 2", school_name: 'בית ספר', bio: '', avatar_path: null },
    session: { session_id: '44444444-4444-4444-8444-444444444444', started_at: '2026-10-19T08:00:00Z' },
    timetable: { periods: [{ number: 1, start: '8:00', end: '8:45' }, { number: 2, start: '8:50', end: '9:35' }] },
    lessons: [{ day: 'sun', period_index: 1, preset_id: P1 }],
    presets: [
      { id: P1, name: 'מתמטיקה 5 יח"ל', short_name: 'מתמטיקה', teacher: 'מורה', room: '12', color: '#1498FD', notes: '', archived: false, assigned: true },
      { id: P2, name: 'היסטוריה', short_name: '', teacher: '', room: '', color: '#444cc1', notes: '', archived: true, assigned: true },
    ],
    events: [{ id: P2, kind: 'exam', title: 'מבחן', date: '2026-10-20', time: '9:00', group_name: '', notes: '' }],
    notifications: [{ id: P1, category: 'change', title: 'שינוי', body: '', date: '2026-10-21', created_at: '2026-10-19T07:00:00Z' }],
    ...overrides,
  });
}

describe('backend configuration', () => {
  it('needs both values and an https (or local) URL', () => {
    expect(parseBackendConfig({})).toBeNull();
    expect(parseBackendConfig({ VITE_SUPABASE_URL: 'https://x.supabase.co' })).toBeNull();
    expect(parseBackendConfig({ VITE_SUPABASE_URL: 'http://evil.example', VITE_SUPABASE_ANON_KEY: 'k' })).toBeNull();
    expect(parseBackendConfig({ VITE_SUPABASE_URL: 'https://x.supabase.co/', VITE_SUPABASE_ANON_KEY: ' k ' })).toEqual({
      url: 'https://x.supabase.co',
      anonKey: 'k',
    });
    expect(parseBackendConfig({ VITE_SUPABASE_URL: 'http://127.0.0.1:54321', VITE_SUPABASE_ANON_KEY: 'k' })).not.toBeNull();
  });
});

describe('account bundle mapping', () => {
  it('maps the server snapshot onto the local models', () => {
    const snapshot = mapBundle(bundle());
    expect(snapshot.summary).toMatchObject({ profileId: PROFILE, displayName: 'דנה', assignablePresetIds: [P1] });
    expect(snapshot.profile).toEqual({ studentName: 'דנה', subtitle: "י' 2 · בית ספר", className: "י' 2" });
    expect(snapshot.presets[0]).toMatchObject({ id: P1, name: 'מתמטיקה', subject: 'מתמטיקה 5 יח"ל', color: '#1498fd' });
    expect(snapshot.presets[1]?.name).toBe('היסטוריה');
    expect(snapshot.timetable.days.sun).toEqual([null, expect.objectContaining({ id: lessonId('sun', 1), presetId: P1, room: '12' })]);
    expect(snapshot.timetable.days.mon).toEqual([null, null]);
    expect(snapshot.events[0]).toMatchObject({ kind: 'exam', group: '', time: '9:00' });
    expect(snapshot.notices[0]).toMatchObject({ category: 'change', createdAt: '2026-10-19T07:00:00Z' });
  });

  it('rejects malformed server data instead of rendering it', () => {
    expect(BundleSchema.safeParse({ ...bundle(), lessons: [{ day: 'fri', period_index: 0, preset_id: P1 }] }).success).toBe(false);
    expect(BundleSchema.safeParse({ ...bundle(), profile: null }).success).toBe(false);
  });

  it('computes the minimal set of cell changes', () => {
    const base = mapBundle(bundle()).timetable;
    const preset = mapBundle(bundle()).presets[0];
    if (!preset) throw new Error('missing preset');
    const lesson = { id: 'x', presetId: preset.id, subject: preset.subject, teacher: '', room: '', color: preset.color };
    const next = setLesson(setLesson(base, { day: 'sun', index: 1 }, null), { day: 'thu', index: 0 }, lesson);
    expect(diffLessons(base, next)).toEqual([
      { day: 'sun', period_index: 1, preset_id: null },
      { day: 'thu', period_index: 0, preset_id: P1 },
    ]);
    expect(diffLessons(base, base)).toEqual([]);
    expect(() => diffLessons(base, setLesson(base, { day: 'mon', index: 0 }, { ...lesson, presetId: null }))).toThrow();
  });
});

describe('login outcomes', () => {
  it('maps every server answer to a clear message', () => {
    expect(loginFailureFromResponse(401, { error: 'invalid_code' })).toEqual({ kind: 'invalid_code' });
    expect(loginFailureFromResponse(409, { error: 'code_in_use' })).toEqual({ kind: 'code_in_use' });
    expect(loginFailureFromResponse(429, { error: 'rate_limited', retry_after: 125 })).toEqual({ kind: 'rate_limited', retryAfterSeconds: 125 });
    expect(loginFailureFromResponse(500, {})).toEqual({ kind: 'unavailable' });
    expect(loginFailureMessage({ kind: 'rate_limited', retryAfterSeconds: 125 })).toContain('3 דקות');
    expect(loginFailureMessage({ kind: 'code_in_use' })).toMatch(/מכשיר אחר/);
  });

  it('describes devices without identifying them', () => {
    const iphone = 'Mozilla/5.0 (iPhone; CPU iPhone OS 18_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.0 Mobile/15E148 Safari/604.1';
    expect(describeDevice(iphone, false)).toBe('iPhone · Safari');
    expect(describeDevice(iphone, true)).toBe('iPhone · אפליקציה ממסך הבית');
    expect(describeDevice('Mozilla/5.0 (Windows NT 10.0) Chrome/130.0 Safari/537.36', false)).toBe('Windows · Chrome');
  });

  it('tells ended sessions apart from network trouble', () => {
    expect(isSessionEndedError({ code: '42501', message: 'session_inactive' })).toBe(true);
    expect(isSessionEndedError({ name: 'AuthApiError', message: 'Invalid Refresh Token: Refresh Token Not Found' })).toBe(true);
    expect(isSessionEndedError({ message: 'TypeError: Failed to fetch' })).toBe(false);
    expect(isNetworkError({ message: 'TypeError: Failed to fetch' })).toBe(true);
    expect(isNetworkError({ name: 'AuthRetryableFetchError', message: '' })).toBe(true);
    expect(isNetworkError({ code: '42501', message: 'session_inactive' })).toBe(false);
  });
});

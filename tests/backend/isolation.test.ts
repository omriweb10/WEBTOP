/** Authorization and data isolation: anon, students and admins see exactly what they may. */
import { describe, expect, it } from 'vitest';
import { adminClient, anonClient, callFunction, createStudent, env, loginStudent, presetIds, sql, stackAvailable } from './helpers';

const TABLES = [
  'admins', 'profiles', 'access_codes', 'user_sessions', 'subject_presets', 'profile_presets',
  'schedule_templates', 'template_lessons', 'user_timetables', 'lessons', 'events', 'notifications',
];

describe.skipIf(!stackAvailable)('authorization and isolation', () => {
  it('gives anonymous callers nothing', async () => {
    const anon = anonClient();
    for (const table of TABLES) {
      const { data, error } = await anon.from(table).select('*').limit(1);
      expect(error !== null || (data ?? []).length === 0, table).toBe(true);
    }
    expect((await anon.rpc('get_my_bundle')).error).not.toBeNull();
    expect((await anon.rpc('admin_disconnect_session', { p_session_id: crypto.randomUUID() })).error).not.toBeNull();
  });

  it('keeps students isolated from each other', async () => {
    const admin = await adminClient();
    const [math, english] = await presetIds();
    const a = await createStudent({ display_name: 'תלמיד א' });
    const b = await createStudent({ display_name: 'תלמיד ב' });
    await admin.rpc('admin_save_user_lessons', { p_profile_id: b.profileId, p_changes: [{ day: 'sun', period_index: 0, preset_id: english }] });
    await admin.from('events').insert({ profile_id: b.profileId, kind: 'exam', title: 'מבחן פרטי של ב', date: '2026-11-01' });
    await admin.from('events').insert({ profile_id: null, kind: 'event', title: 'טיול שכבתי', date: '2026-11-02' });
    void math;

    const { client } = await loginStudent(a.code);
    const profiles = await client.from('profiles').select('id');
    expect(profiles.data?.map((p) => p.id)).toEqual([a.profileId]);
    expect((await client.from('lessons').select('*').eq('profile_id', b.profileId)).data).toEqual([]);
    expect((await client.from('user_sessions').select('*')).data).toHaveLength(1);
    const bundle = (await client.rpc('get_my_bundle')).data;
    const titles = bundle.events.map((e: { title: string }) => e.title);
    expect(titles).toContain('טיול שכבתי');
    expect(titles).not.toContain('מבחן פרטי של ב');
    expect(bundle.lessons).toEqual([]);
  });

  it('blocks direct student writes and admin/service functions', async () => {
    const { profileId, code } = await createStudent();
    const { client } = await loginStudent(code);
    expect((await client.from('profiles').update({ display_name: 'hacked' }).eq('id', profileId).select()).data ?? []).toEqual([]);
    expect((await client.from('subject_presets').update({ teacher: 'hacked' }).neq('id', crypto.randomUUID()).select()).data ?? []).toEqual([]);
    expect((await client.from('lessons').insert({ profile_id: profileId, day: 'sun', period_index: 0, preset_id: (await presetIds())[0] })).error).not.toBeNull();
    expect((await client.rpc('admin_set_profile_status', { p_profile_id: profileId, p_status: 'active' })).error?.message).toMatch(/admin_required/);
    expect((await client.rpc('svc_claim_student_session', { p_code_hash: '\\x00', p_ip_hash: '\\x00', p_device: '' })).error).not.toBeNull();
    const [preset] = await sql<{ teacher: string }>('select teacher from public.subject_presets limit 1');
    expect(preset?.teacher).not.toBe('hacked');
  });

  it('never exposes code hashes, not even to admins', async () => {
    const admin = await adminClient();
    await createStudent();
    expect((await admin.from('access_codes').select('code_hash').limit(1)).error).not.toBeNull();
    expect((await admin.from('access_codes').select('id, code_hint').limit(1)).error).toBeNull();
  });

  it('lets students save lessons only with presets assigned to them', async () => {
    const admin = await adminClient();
    const [assigned, notAssigned] = await presetIds();
    const { profileId, code } = await createStudent();
    await admin.rpc('admin_set_profile_presets', { p_profile_id: profileId, p_preset_ids: [assigned] });
    const { client } = await loginStudent(code);

    const ok = await client.rpc('save_my_lessons', { p_changes: [{ day: 'mon', period_index: 2, preset_id: assigned }] });
    expect(ok.error).toBeNull();
    expect(ok.data).toEqual([{ day: 'mon', period_index: 2, preset_id: assigned }]);

    const denied = await client.rpc('save_my_lessons', { p_changes: [{ day: 'mon', period_index: 3, preset_id: notAssigned }] });
    expect(denied.error?.message).toMatch(/preset_not_assigned/);
    const badPeriod = await client.rpc('save_my_lessons', { p_changes: [{ day: 'mon', period_index: 13, preset_id: assigned }] });
    expect(badPeriod.error?.message).toMatch(/invalid_period/);
    const badDay = await client.rpc('save_my_lessons', { p_changes: [{ day: 'fri', period_index: 0, preset_id: assigned }] });
    expect(badDay.error?.message).toMatch(/invalid_day/);

    // Moving an existing lesson keeps working even after the admin unassigns its preset.
    await admin.rpc('admin_set_profile_presets', { p_profile_id: profileId, p_preset_ids: [] });
    const moved = await client.rpc('save_my_lessons', {
      p_changes: [
        { day: 'mon', period_index: 2, preset_id: null },
        { day: 'tue', period_index: 0, preset_id: assigned },
      ],
    });
    expect(moved.error).toBeNull();
    expect(moved.data).toEqual([{ day: 'tue', period_index: 0, preset_id: assigned }]);
  });

  it('enforces avatar storage policies', async () => {
    const admin = await adminClient();
    const a = await createStudent();
    const b = await createStudent();
    const png = Uint8Array.from(atob('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg=='), (c) => c.charCodeAt(0));
    const pathA = `${a.profileId}/${crypto.randomUUID()}.png`;
    const pathB = `${b.profileId}/${crypto.randomUUID()}.png`;
    expect((await admin.storage.from('avatars').upload(pathA, png, { contentType: 'image/png' })).error).toBeNull();
    expect((await admin.storage.from('avatars').upload(pathB, png, { contentType: 'image/png' })).error).toBeNull();
    expect((await admin.storage.from('avatars').upload(`${a.profileId}/x.gif`, png, { contentType: 'image/gif' })).error).not.toBeNull();

    const { client } = await loginStudent(a.code);
    expect((await client.storage.from('avatars').createSignedUrl(pathA, 60)).error).toBeNull();
    expect((await client.storage.from('avatars').createSignedUrl(pathB, 60)).error).not.toBeNull();
    expect((await client.storage.from('avatars').upload(`${a.profileId}/${crypto.randomUUID()}.png`, png, { contentType: 'image/png' })).error).not.toBeNull();
    const signed = (await client.storage.from('avatars').createSignedUrl(pathA, 60)).data?.signedUrl;
    const download = await fetch(signed ?? '');
    expect(download.status).toBe(200);
    expect(env.apiUrl).toBeTruthy();
  });

  it('lets admins change account status and auth links only through the server', async () => {
    const admin = await adminClient();
    const { profileId, code } = await createStudent();
    const a = await loginStudent(code);
    expect((await admin.from('profiles').update({ status: 'disabled' }).eq('id', profileId)).error).not.toBeNull();
    expect((await admin.from('profiles').update({ auth_user_id: null }).eq('id', profileId)).error).not.toBeNull();
    expect((await admin.from('profiles').insert({ display_name: 'x', status: 'disabled' })).error).not.toBeNull();
    // The session is untouched by the refused writes.
    expect((await a.client.rpc('get_my_bundle')).error).toBeNull();
  });

  it('only admins may create access codes', async () => {
    const { profileId, code } = await createStudent();
    const { client } = await loginStudent(code);
    const studentToken = (await client.auth.getSession()).data.session?.access_token;
    expect((await callFunction('admin-access-code', { profileId, mode: 'generate' }, { token: studentToken })).status).toBe(403);
    expect((await callFunction('admin-access-code', { profileId, mode: 'generate' })).status).toBe(403);
  });
});

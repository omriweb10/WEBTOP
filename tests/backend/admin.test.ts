/** Admin capabilities: users, codes, presets, templates and independent timetables. */
import { describe, expect, it } from 'vitest';
import { adminClient, callFunction, createStudent, loginStudent, presetIds, sql, stackAvailable, uniqueDigits } from './helpers';

/** The admin's current access token (for Edge Function calls). */
async function adminToken(): Promise<string | undefined> {
  return (await (await adminClient()).auth.getSession()).data.session?.access_token;
}

describe.skipIf(!stackAvailable)('admin operations', () => {
  it('creates and edits users with validation', async () => {
    const admin = await adminClient();
    const created = await admin
      .from('profiles')
      .insert({ display_name: 'נועה', class_name: "י' 2", school_name: 'בית ספר לדוגמה', bio: 'אוהבת מתמטיקה' })
      .select()
      .single();
    expect(created.error).toBeNull();
    const updated = await admin.from('profiles').update({ class_name: "יא' 2" }).eq('id', created.data.id).select().single();
    expect(updated.data.class_name).toBe("יא' 2");
    expect((await admin.from('profiles').insert({ display_name: '' })).error).not.toBeNull();
    expect((await admin.from('profiles').insert({ display_name: 'x', bio: 'א'.repeat(301) })).error).not.toBeNull();
    const [timetable] = await sql('select jsonb_array_length(periods) as n from public.user_timetables where profile_id = $1', [created.data.id]);
    expect(timetable?.n).toBe(13);
  });

  it('warns about weak custom codes and refuses duplicates', async () => {
    const token = await adminToken();
    const { profileId } = await createStudent();
    const numeric = uniqueDigits(9);
    const weak = await callFunction('admin-access-code', { profileId, mode: 'custom', code: '123456' }, { token });
    expect(weak.status).toBe(422);
    expect(weak.body.error).toBe('code_too_weak');
    const forced = await callFunction('admin-access-code', { profileId, mode: 'custom', code: numeric, allowWeak: true }, { token });
    expect(forced.status).toBe(200);
    expect((await callFunction('admin-access-code', { profileId, mode: 'custom', code: '12' }, { token })).body.error).toBe('code_too_short');

    const other = await createStudent();
    const dup = await callFunction('admin-access-code', { profileId: other.profileId, mode: 'custom', code: numeric, allowWeak: true }, { token });
    expect(dup.status).toBe(409);
    expect(dup.body.error).toBe('code_taken');
  });

  it('manages presets; presets in use cannot be hard-deleted', async () => {
    const admin = await adminClient();
    const created = await admin.from('subject_presets').insert({ name: 'רובוטיקה', teacher: 'מורה', room: '12', color: '#259e3b' }).select().single();
    expect(created.error).toBeNull();
    expect((await admin.from('subject_presets').insert({ name: 'צבע שגוי', color: 'green' })).error).not.toBeNull();
    const { profileId } = await createStudent();
    await admin.rpc('admin_save_user_lessons', { p_profile_id: profileId, p_changes: [{ day: 'wed', period_index: 1, preset_id: created.data.id }] });
    expect((await admin.from('subject_presets').delete().eq('id', created.data.id)).error).not.toBeNull();
    const archived = await admin.from('subject_presets').update({ archived_at: new Date().toISOString() }).eq('id', created.data.id).select().single();
    expect(archived.error).toBeNull();
    // Admin placing a preset also makes it available to the student.
    const [link] = await sql('select 1 as ok from public.profile_presets where profile_id = $1 and preset_id = $2', [profileId, created.data.id]);
    expect(link?.ok).toBe(1);
  });

  it('saves, duplicates and assigns templates, respecting customised timetables', async () => {
    const admin = await adminClient();
    const [p1, p2] = await presetIds();
    const periods = [
      { number: 1, start: '8:00', end: '8:45' },
      { number: 2, start: '8:50', end: '9:35' },
    ];
    const save = await admin.rpc('admin_save_template', {
      p_template_id: null,
      p_name: 'שכבת י',
      p_periods: periods,
      p_lessons: [{ day: 'sun', period_index: 0, preset_id: p1 }, { day: 'thu', period_index: 1, preset_id: p2 }],
    });
    expect(save.error).toBeNull();
    const templateId = save.data as string;
    expect((await admin.rpc('admin_save_template', { p_template_id: null, p_name: 'רע', p_periods: [{ number: 1, start: '9:00', end: '8:00' }], p_lessons: [] })).error).not.toBeNull();

    const dup = await admin.rpc('admin_duplicate_template', { p_template_id: templateId, p_name: 'שכבת י (עותק)' });
    const [copied] = await sql('select count(*)::int as n from public.template_lessons where template_id = $1', [dup.data]);
    expect(copied?.n).toBe(2);

    const a = await createStudent();
    const b = await createStudent();
    const first = await admin.rpc('admin_assign_template', { p_template_id: templateId, p_profile_ids: [a.profileId, b.profileId], p_overwrite_customized: false });
    expect(first.data.assigned).toHaveLength(2);

    // Student A customises their own copy; B and the template stay unchanged.
    const { client } = await loginStudent(a.code);
    await client.rpc('save_my_lessons', { p_changes: [{ day: 'sun', period_index: 0, preset_id: null }] });
    const [bLessons] = await sql('select count(*)::int as n from public.lessons where profile_id = $1', [b.profileId]);
    const [tLessons] = await sql('select count(*)::int as n from public.template_lessons where template_id = $1', [templateId]);
    expect(bLessons?.n).toBe(2);
    expect(tLessons?.n).toBe(2);

    const preview = await admin.rpc('admin_template_assignment_preview', { p_template_id: templateId, p_profile_ids: [a.profileId, b.profileId] });
    expect(preview.data.map((p: { id: string }) => p.id)).toEqual([a.profileId]);
    const skip = await admin.rpc('admin_assign_template', { p_template_id: templateId, p_profile_ids: [a.profileId, b.profileId], p_overwrite_customized: false });
    expect(skip.data.skipped_customized).toEqual([a.profileId]);
    const [aAfterSkip] = await sql('select count(*)::int as n from public.lessons where profile_id = $1', [a.profileId]);
    expect(aAfterSkip?.n).toBe(1);
    await admin.rpc('admin_assign_template', { p_template_id: templateId, p_profile_ids: [a.profileId], p_overwrite_customized: true });
    const [aAfterOverwrite] = await sql('select count(*)::int as n from public.lessons where profile_id = $1', [a.profileId]);
    expect(aAfterOverwrite?.n).toBe(2);
    // Template presets became available to the students.
    const [available] = await sql('select count(*)::int as n from public.profile_presets where profile_id = $1', [b.profileId]);
    expect(available?.n).toBe(2);
  });

  it('changes a student bell schedule and trims lessons beyond it', async () => {
    const admin = await adminClient();
    const [p1] = await presetIds();
    const { profileId } = await createStudent();
    await admin.rpc('admin_save_user_lessons', { p_profile_id: profileId, p_changes: [{ day: 'sun', period_index: 10, preset_id: p1 }, { day: 'sun', period_index: 0, preset_id: p1 }] });
    const result = await admin.rpc('admin_set_user_periods', { p_profile_id: profileId, p_periods: [{ number: 1, start: '8:00', end: '8:50' }] });
    expect(result.error).toBeNull();
    const rows = await sql('select period_index from public.lessons where profile_id = $1', [profileId]);
    expect(rows).toEqual([{ period_index: 0 }]);
  });

  it('shows connected users in the overview and deletes users completely', async () => {
    const admin = await adminClient();
    const { profileId, code } = await createStudent({ display_name: 'למחיקה' });
    await loginStudent(code);
    const overview = await admin.from('admin_user_overview').select('*').eq('id', profileId).single();
    expect(overview.data.session_status).toBe('active');
    expect(overview.data.code_hint).toHaveLength(2);
    const [authUser] = await sql('select auth_user_id from public.profiles where id = $1', [profileId]);

    expect((await admin.rpc('admin_delete_profile', { p_profile_id: profileId })).error).toBeNull();
    expect(await sql('select 1 from public.profiles where id = $1', [profileId])).toEqual([]);
    expect(await sql('select 1 from auth.users where id = $1', [authUser?.auth_user_id])).toEqual([]);
    expect(await sql('select 1 from public.access_codes where profile_id = $1', [profileId])).toEqual([]);
  });
});

/** Admin capabilities: users, codes, presets, templates and independent timetables. */
import { describe, expect, it } from 'vitest';
import { adminClient, callFunction, createStudent, createUserPreset, loginStudent, presetIds, sql, stackAvailable, uniqueDigits } from './helpers';

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

  it('manages library presets; a library preset used by a template cannot be removed', async () => {
    const admin = await adminClient();
    const created = await admin.from('subject_presets').insert({ name: 'רובוטיקה', teacher: 'מורה', room: '12', color: '#259e3b' }).select().single();
    expect(created.error).toBeNull();
    expect(created.data.profile_id).toBeNull();
    expect((await admin.from('subject_presets').insert({ name: 'צבע שגוי', color: 'green' })).error).not.toBeNull();
    const template = await admin.rpc('admin_save_template', {
      p_template_id: null,
      p_name: 'עם רובוטיקה',
      p_periods: [{ number: 1, start: '8:00', end: '8:45' }],
      p_lessons: [{ day: 'wed', period_index: 0, preset_id: created.data.id }],
    });
    expect(template.error).toBeNull();
    // Direct deletes are not allowed; the RPC refuses while a template uses it.
    await admin.from('subject_presets').delete().eq('id', created.data.id);
    expect(await sql('select 1 from public.subject_presets where id = $1', [created.data.id])).toHaveLength(1);
    expect((await admin.rpc('admin_remove_preset', { p_preset_id: created.data.id })).error?.message).toMatch(/preset_in_template/);
    const archived = await admin.from('subject_presets').update({ archived_at: new Date().toISOString() }).eq('id', created.data.id).select().single();
    expect(archived.error).toBeNull();
    // The owner of a preset can never be changed.
    expect((await admin.from('subject_presets').update({ profile_id: (await createStudent()).profileId }).eq('id', created.data.id)).error).not.toBeNull();
    // A template can only use library presets, never a student's own.
    const { profileId } = await createStudent();
    const own = await createUserPreset(profileId, { name: 'פרטי' });
    const bad = await admin.rpc('admin_save_template', {
      p_template_id: null,
      p_name: 'שגויה',
      p_periods: [{ number: 1, start: '8:00', end: '8:45' }],
      p_lessons: [{ day: 'sun', period_index: 0, preset_id: own }],
    });
    expect(bad.error?.message).toMatch(/preset_not_in_library/);
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
    // Each student received their own copies of the template's subjects.
    const owned = async (id: string) =>
      sql<{ id: string; library_preset_id: string }>('select id, library_preset_id from public.subject_presets where profile_id = $1 order by name', [id]);
    const aPresets = await owned(a.profileId);
    const bPresets = await owned(b.profileId);
    expect(aPresets.map((p) => p.library_preset_id).sort()).toEqual([p1, p2].sort());
    expect(bPresets).toHaveLength(2);
    expect(aPresets.some((p) => bPresets.some((q) => q.id === p.id))).toBe(false);
    const [mismatched] = await sql<{ n: number }>(
      'select count(*)::int as n from public.lessons l join public.subject_presets sp on sp.id = l.preset_id where l.profile_id = any($1) and sp.profile_id <> l.profile_id',
      [[a.profileId, b.profileId]],
    );
    expect(mismatched?.n).toBe(0);

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
    // Re-applying reuses the student's existing copies instead of duplicating them.
    expect(await owned(a.profileId)).toEqual(aPresets);
  });

  it('changes a student bell schedule and trims lessons beyond it', async () => {
    const admin = await adminClient();
    const { profileId } = await createStudent();
    const p1 = await createUserPreset(profileId, { name: 'ספרות' });
    await admin.rpc('admin_save_user_lessons', { p_profile_id: profileId, p_changes: [{ day: 'sun', period_index: 10, preset_id: p1 }, { day: 'sun', period_index: 0, preset_id: p1 }] });
    const result = await admin.rpc('admin_set_user_periods', { p_profile_id: profileId, p_periods: [{ number: 1, start: '8:00', end: '8:50' }] });
    expect(result.error).toBeNull();
    const rows = await sql('select period_index from public.lessons where profile_id = $1', [profileId]);
    expect(rows).toEqual([{ period_index: 0 }]);
  });

  it('shows connected users in the overview and deletes users completely', async () => {
    const admin = await adminClient();
    const { profileId, code } = await createStudent({ display_name: 'למחיקה' });
    const preset = await createUserPreset(profileId, { name: 'גאוגרפיה' });
    await admin.rpc('admin_save_user_lessons', { p_profile_id: profileId, p_changes: [{ day: 'sun', period_index: 0, preset_id: preset }] });
    await loginStudent(code);
    const overview = await admin.from('admin_user_overview').select('*').eq('id', profileId).single();
    expect(overview.data.session_status).toBe('active');
    expect(overview.data.code_hint).toHaveLength(2);
    const [authUser] = await sql('select auth_user_id from public.profiles where id = $1', [profileId]);

    expect((await admin.rpc('admin_delete_profile', { p_profile_id: profileId })).error).toBeNull();
    expect(await sql('select 1 from public.profiles where id = $1', [profileId])).toEqual([]);
    expect(await sql('select 1 from auth.users where id = $1', [authUser?.auth_user_id])).toEqual([]);
    expect(await sql('select 1 from public.access_codes where profile_id = $1', [profileId])).toEqual([]);
    expect(await sql('select 1 from public.subject_presets where profile_id = $1', [profileId])).toEqual([]);
  });
});

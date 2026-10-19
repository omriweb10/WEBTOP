/** Per-user subject presets: every student has an independent list, enforced by the database. */
import { describe, expect, it } from 'vitest';
import { adminClient, createStudent, createUserPreset, loginStudent, presetIds, sql, stackAvailable } from './helpers';

interface BundlePreset {
  id: string;
  name: string;
  teacher: string;
  room: string;
  color: string;
  assigned: boolean;
  archived: boolean;
}

/** The presets a signed-in student receives in their snapshot. */
async function bundlePresets(code: string): Promise<BundlePreset[]> {
  const { client } = await loginStudent(code);
  const bundle = await client.rpc('get_my_bundle');
  if (bundle.error) throw bundle.error;
  await client.rpc('end_my_session');
  return bundle.data.presets as BundlePreset[];
}

describe.skipIf(!stackAvailable)('per-user subject presets', () => {
  it('gives two students different subjects, even with the same name', async () => {
    const a = await createStudent({ display_name: 'משתמש A' });
    const b = await createStudent({ display_name: 'משתמש B' });
    await createUserPreset(a.profileId, { name: 'מתמטיקה', teacher: 'דניאל', room: '101', color: '#1498fd' });
    await createUserPreset(a.profileId, { name: 'אנגלית', teacher: 'שרה', room: '205', color: '#999a9d' });
    await createUserPreset(a.profileId, { name: 'היסטוריה', teacher: 'דוד', room: '107', color: '#444cc1' });
    await createUserPreset(b.profileId, { name: 'מתמטיקה', teacher: 'מיכאל', room: '302', color: '#1498fd' });
    await createUserPreset(b.profileId, { name: 'כימיה', teacher: 'רחל', room: 'מעבדה 2', color: '#92be43' });

    const fromA = await bundlePresets(a.code);
    const fromB = await bundlePresets(b.code);
    expect(fromA.map((p) => [p.name, p.teacher, p.room])).toEqual([
      ['אנגלית', 'שרה', '205'],
      ['היסטוריה', 'דוד', '107'],
      ['מתמטיקה', 'דניאל', '101'],
    ]);
    expect(fromB.map((p) => [p.name, p.teacher, p.room])).toEqual([
      ['כימיה', 'רחל', 'מעבדה 2'],
      ['מתמטיקה', 'מיכאל', '302'],
    ]);
    expect(fromA.every((p) => p.assigned && !p.archived)).toBe(true);
    expect(fromA.some((p) => fromB.some((q) => q.id === p.id))).toBe(false);
  });

  it('editing one student\'s subject never changes another student\'s subject or timetable', async () => {
    const admin = await adminClient();
    const a = await createStudent();
    const b = await createStudent();
    const mathA = await createUserPreset(a.profileId, { name: 'מתמטיקה', teacher: 'דניאל', room: '101' });
    const mathB = await createUserPreset(b.profileId, { name: 'מתמטיקה', teacher: 'מיכאל', room: '302' });
    await admin.rpc('admin_save_user_lessons', { p_profile_id: a.profileId, p_changes: [{ day: 'sun', period_index: 0, preset_id: mathA }] });
    await admin.rpc('admin_save_user_lessons', { p_profile_id: b.profileId, p_changes: [{ day: 'sun', period_index: 0, preset_id: mathB }] });

    const edited = await admin.from('subject_presets').update({ teacher: 'יעל', room: '999', color: '#e50066' }).eq('id', mathA).select().single();
    expect(edited.error).toBeNull();

    const [rowB] = await sql<{ teacher: string; room: string; color: string }>('select teacher, room, color from public.subject_presets where id = $1', [mathB]);
    expect(rowB).toEqual({ teacher: 'מיכאל', room: '302', color: '#1498fd' });
    const lessonsB = await sql('select l.day, l.period_index, sp.teacher from public.lessons l join public.subject_presets sp on sp.id = l.preset_id where l.profile_id = $1', [b.profileId]);
    expect(lessonsB).toEqual([{ day: 'sun', period_index: 0, teacher: 'מיכאל' }]);
    expect((await bundlePresets(b.code)).map((p) => p.teacher)).toEqual(['מיכאל']);
    expect((await bundlePresets(a.code)).map((p) => p.teacher)).toEqual(['יעל']);
  });

  it('lets a student read only their own presets and never write any', async () => {
    const a = await createStudent();
    const b = await createStudent();
    const own = await createUserPreset(a.profileId, { name: 'ביולוגיה' });
    const foreign = await createUserPreset(b.profileId, { name: 'ביולוגיה' });
    const { client } = await loginStudent(a.code);

    const visible = await client.from('subject_presets').select('id');
    expect(visible.data?.map((p) => p.id)).toEqual([own]);
    expect((await client.from('subject_presets').select('id').eq('id', foreign)).data).toEqual([]);
    expect((await client.from('subject_presets').select('id').is('profile_id', null)).data).toEqual([]);
    expect((await client.from('admin_preset_overview').select('id')).data?.map((p) => p.id)).toEqual([own]);

    // Writes: insert, update and delete are refused (RLS / privileges); nothing changes.
    expect((await client.from('subject_presets').insert({ profile_id: a.profileId, name: 'שלי', color: '#1498fd' })).error).not.toBeNull();
    expect((await client.from('subject_presets').update({ teacher: 'hacked' }).eq('id', own).select()).data ?? []).toEqual([]);
    await client.from('subject_presets').delete().eq('id', own);
    expect((await client.rpc('admin_copy_presets', { p_preset_ids: [foreign], p_profile_ids: [a.profileId] })).error?.message).toMatch(/admin_required/);
    expect((await client.rpc('admin_remove_preset', { p_preset_id: own })).error?.message).toMatch(/admin_required/);
    const rows = await sql<{ profile_id: string; teacher: string }>('select profile_id, teacher from public.subject_presets where id = any($1) order by profile_id', [[own, foreign]]);
    expect(rows).toHaveLength(2);
    expect(rows.every((r) => r.teacher === '')).toBe(true);
    expect(await sql('select 1 from public.subject_presets where profile_id = $1', [a.profileId])).toHaveLength(1);
  });

  it('never places a preset in another student\'s timetable, even for the admin', async () => {
    const admin = await adminClient();
    const a = await createStudent();
    const b = await createStudent();
    const ofB = await createUserPreset(b.profileId, { name: 'תנ"ך' });
    const [library] = await presetIds();
    const foreign = await admin.rpc('admin_save_user_lessons', { p_profile_id: a.profileId, p_changes: [{ day: 'sun', period_index: 0, preset_id: ofB }] });
    expect(foreign.error?.message).toMatch(/preset_not_assigned/);
    const fromLibrary = await admin.rpc('admin_save_user_lessons', { p_profile_id: a.profileId, p_changes: [{ day: 'sun', period_index: 0, preset_id: library }] });
    expect(fromLibrary.error?.message).toMatch(/preset_not_assigned/);
    // The composite foreign key enforces it below the RPCs too.
    await expect(sql('insert into public.lessons (profile_id, day, period_index, preset_id) values ($1, $2, 0, $3)', [a.profileId, 'sun', ofB])).rejects.toThrow(
      /lessons_preset_owned_fkey/,
    );
    expect(await sql('select 1 from public.lessons where profile_id = $1', [a.profileId])).toEqual([]);
  });

  it('copies selected or all presets from another student or the library as independent rows', async () => {
    const admin = await adminClient();
    const a = await createStudent();
    const b = await createStudent();
    const c = await createStudent();
    const math = await createUserPreset(a.profileId, { name: 'מתמטיקה', teacher: 'דניאל', room: '101' });
    const english = await createUserPreset(a.profileId, { name: 'אנגלית', teacher: 'שרה', room: '205' });
    const [library] = await presetIds();

    // Selected presets into two students at once, plus one from the library.
    const copied = await admin.rpc('admin_copy_presets', { p_preset_ids: [math, library], p_profile_ids: [b.profileId, c.profileId] });
    expect(copied.error).toBeNull();
    expect(copied.data).toBe(4);
    // All of A's presets into B; copying into the owner itself is skipped.
    const all = await admin.rpc('admin_copy_presets', { p_preset_ids: [math, english], p_profile_ids: [b.profileId, a.profileId] });
    expect(all.data).toBe(2);

    const ofB = await sql<{ id: string; name: string; teacher: string; library_preset_id: string | null }>(
      'select id, name, teacher, library_preset_id from public.subject_presets where profile_id = $1 order by name, teacher',
      [b.profileId],
    );
    expect(ofB).toHaveLength(4);
    expect(ofB.every((p) => p.id !== math && p.id !== english && p.id !== library)).toBe(true);
    expect(ofB.filter((p) => p.library_preset_id === library)).toHaveLength(1);
    expect(await sql('select 1 from public.subject_presets where profile_id = $1', [a.profileId])).toHaveLength(2);

    // Later edits on either side stay apart.
    await admin.from('subject_presets').update({ teacher: 'אחר' }).eq('id', math);
    const copyOfMath = ofB.find((p) => p.name === 'מתמטיקה');
    await admin.from('subject_presets').update({ room: '777' }).eq('id', copyOfMath?.id);
    const [source] = await sql<{ teacher: string; room: string }>('select teacher, room from public.subject_presets where id = $1', [math]);
    const [copy] = await sql<{ teacher: string; room: string }>('select teacher, room from public.subject_presets where id = $1', [copyOfMath?.id]);
    expect(source).toEqual({ teacher: 'אחר', room: '101' });
    expect(copy).toEqual({ teacher: 'דניאל', room: '777' });
  });

  it('removes a placed preset only with an explicit choice for its lessons', async () => {
    const admin = await adminClient();
    const a = await createStudent();
    const b = await createStudent();
    const physics = await createUserPreset(a.profileId, { name: 'פיזיקה' });
    const chemistry = await createUserPreset(a.profileId, { name: 'כימיה' });
    const art = await createUserPreset(a.profileId, { name: 'אמנות' });
    const unused = await createUserPreset(a.profileId, { name: 'לא בשימוש' });
    const ofB = await createUserPreset(b.profileId, { name: 'פיזיקה' });
    await admin.rpc('admin_save_user_lessons', {
      p_profile_id: a.profileId,
      p_changes: [
        { day: 'sun', period_index: 0, preset_id: physics },
        { day: 'mon', period_index: 1, preset_id: physics },
        { day: 'tue', period_index: 2, preset_id: art },
      ],
    });
    await admin.rpc('admin_save_user_lessons', { p_profile_id: b.profileId, p_changes: [{ day: 'sun', period_index: 0, preset_id: ofB }] });
    const usage = await admin.from('admin_preset_overview').select('id, lesson_count').eq('profile_id', a.profileId).order('name');
    expect(Object.fromEntries((usage.data ?? []).map((r) => [r.id, r.lesson_count]))).toEqual({ [physics]: 2, [chemistry]: 0, [art]: 1, [unused]: 0 });

    // No choice: refused, nothing changes. Direct deletes cannot remove it either.
    const refused = await admin.rpc('admin_remove_preset', { p_preset_id: physics });
    expect(refused.error?.message).toMatch(/preset_in_use/);
    await admin.from('subject_presets').delete().eq('id', physics);
    expect(await sql('select 1 from public.lessons where preset_id = $1', [physics])).toHaveLength(2);

    // A replacement must be another, active preset of the same student.
    expect((await admin.rpc('admin_remove_preset', { p_preset_id: physics, p_lessons: 'replace', p_replacement_id: ofB })).error?.message).toMatch(/invalid_replacement/);
    expect((await admin.rpc('admin_remove_preset', { p_preset_id: physics, p_lessons: 'replace', p_replacement_id: physics })).error?.message).toMatch(/invalid_replacement/);
    const replaced = await admin.rpc('admin_remove_preset', { p_preset_id: physics, p_lessons: 'replace', p_replacement_id: chemistry });
    expect(replaced.data).toBe(2);
    const lessonsA = await sql('select day, period_index, preset_id from public.lessons where profile_id = $1 order by day, period_index', [a.profileId]);
    expect(lessonsA).toEqual([
      { day: 'mon', period_index: 1, preset_id: chemistry },
      { day: 'sun', period_index: 0, preset_id: chemistry },
      { day: 'tue', period_index: 2, preset_id: art },
    ]);

    // Deleting the lessons too is an explicit choice.
    expect((await admin.rpc('admin_remove_preset', { p_preset_id: art, p_lessons: 'delete' })).data).toBe(1);
    expect((await admin.rpc('admin_remove_preset', { p_preset_id: unused })).data).toBe(0);
    expect(await sql('select name from public.subject_presets where profile_id = $1', [a.profileId])).toEqual([{ name: 'כימיה' }]);
    // Student B is untouched.
    expect(await sql('select preset_id from public.lessons where profile_id = $1', [b.profileId])).toEqual([{ preset_id: ofB }]);
  });

  it('keeps a student\'s own edits after logging out and back in', async () => {
    const { profileId, code } = await createStudent();
    const music = await createUserPreset(profileId, { name: 'מוזיקה', teacher: 'נועה', room: '3' });
    const first = await loginStudent(code);
    const saved = await first.client.rpc('save_my_lessons', { p_changes: [{ day: 'thu', period_index: 4, preset_id: music }] });
    expect(saved.error).toBeNull();
    expect((await first.client.rpc('end_my_session')).data).toBe(true);

    const second = await loginStudent(code);
    expect(second.status).toBe(200);
    const bundle = (await second.client.rpc('get_my_bundle')).data;
    expect(bundle.lessons).toEqual([{ day: 'thu', period_index: 4, preset_id: music }]);
    expect(bundle.presets.map((p: BundlePreset) => [p.name, p.teacher, p.room])).toEqual([['מוזיקה', 'נועה', '3']]);
  });
});

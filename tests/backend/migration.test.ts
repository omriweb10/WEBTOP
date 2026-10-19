/**
 * Upgrading an existing project: the per-user presets migration must keep every student's
 * timetable exactly as it was. Builds a scratch database with the migrations that came
 * before it, fills it with data in the old shared-preset model, applies the real migration
 * file and compares before/after.
 */
import { readdirSync, readFileSync } from 'node:fs';
import path from 'node:path';
import pg from 'pg';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { env, stackAvailable } from './helpers';

const MIGRATION = '20261019130000_user_owned_presets.sql';
const MIGRATIONS_DIR = path.resolve('supabase/migrations');

// What Supabase Auth (GoTrue) provides in a real project, reduced to what migrations use.
const AUTH_STUB = `
  create table auth.users (id uuid primary key, email text);
  create table auth.sessions (id uuid primary key, user_id uuid references auth.users (id) on delete cascade);
  create function auth.uid() returns uuid language sql stable as $$ select null::uuid $$;
  create function auth.jwt() returns jsonb language sql stable as $$ select '{}'::jsonb $$;
`;

const database = `webtop_migration_${Date.now().toString(36)}_${Math.floor(Math.random() * 1e6)}`;
let db: pg.Client | null = null;

/** Runs SQL as the owner in the scratch database. */
async function query<T extends pg.QueryResultRow = pg.QueryResultRow>(text: string, params: unknown[] = []): Promise<T[]> {
  if (!db) throw new Error('scratch database not ready');
  return (await db.query<T>(text, params)).rows;
}

/** Runs a migration (or bootstrap) file. */
async function runFile(file: string): Promise<void> {
  await query(readFileSync(file, 'utf8'));
}

/** A connection string for another database on the same server. */
function urlFor(name: string): string {
  const url = new URL(env.dbUrl);
  url.pathname = `/${name}`;
  return url.toString();
}

/** One student's timetable as the student sees it (independent of preset ids). */
async function visibleTimetable(profileId: string) {
  return query(
    `select l.day, l.period_index, sp.name, sp.short_name, sp.teacher, sp.room, sp.color, sp.notes
       from public.lessons l join public.subject_presets sp on sp.id = l.preset_id
      where l.profile_id = $1 order by l.day, l.period_index`,
    [profileId],
  );
}

/** visibleTimetable for several students, one query at a time (a pg client is sequential). */
async function timetablesOf(profileIds: readonly string[]) {
  const result = [];
  for (const id of profileIds) result.push(await visibleTimetable(id));
  return result;
}

describe.skipIf(!stackAvailable)('migration to per-user presets', () => {
  beforeAll(async () => {
    const admin = new pg.Client({ connectionString: env.dbUrl });
    await admin.connect();
    await admin.query(`create database ${database} template template0 encoding 'UTF8'`);
    await admin.end();
    db = new pg.Client({ connectionString: urlFor(database) });
    await db.connect();
    await runFile(path.resolve('scripts/local-stack/bootstrap.sql'));
    await query(AUTH_STUB);
    const earlier = readdirSync(MIGRATIONS_DIR).filter((f) => f.endsWith('.sql') && f < MIGRATION).sort();
    for (const file of earlier) await runFile(path.join(MIGRATIONS_DIR, file));
  }, 60_000);

  afterAll(async () => {
    await db?.end();
    const admin = new pg.Client({ connectionString: env.dbUrl });
    await admin.connect();
    await admin.query(`drop database if exists ${database} with (force)`);
    await admin.end();
  });

  it('gives every student their own copies and keeps all lessons, templates and the library', async () => {
    // Legacy data: shared presets, assignments, lessons (one placed but not assigned, one
    // archived), a student with nothing, a template and a customised timetable.
    const id = async (name: string) => (await query<{ id: string }>('select id from public.subject_presets where name = $1', [name]))[0]?.id;
    const [robotics] = await query<{ id: string }>(
      "insert into public.subject_presets (name, short_name, teacher, room, color, notes) values ('רובוטיקה', 'רובו', 'מורה', '12', '#259e3b', 'מעבדה') returning id",
    );
    const [old] = await query<{ id: string }>("insert into public.subject_presets (name, color, archived_at) values ('ישן', '#e50066', now()) returning id");
    const [s1, s2, s3] = await query<{ id: string }>(
      "insert into public.profiles (display_name) values ('תלמיד 1'), ('תלמיד 2'), ('תלמיד 3') returning id",
    );
    const [math, english, history, chemistry] = [await id('מתמטיקה'), await id('אנגלית'), await id('היסטוריה'), await id('כימיה')];
    await query(
      `insert into public.profile_presets (profile_id, preset_id) values
         ($1, $3), ($1, $4), ($1, $5), ($2, $3), ($2, $6)`,
      [s1?.id, s2?.id, math, english, robotics?.id, old?.id],
    );
    await query(
      `insert into public.lessons (profile_id, day, period_index, preset_id) values
         ($1, 'sun', 0, $3), ($1, 'sun', 1, $4), ($1, 'mon', 0, $5), ($1, 'tue', 3, $6),
         ($2, 'sun', 0, $3), ($2, 'wed', 2, $7)`,
      [s1?.id, s2?.id, math, english, robotics?.id, history, old?.id],
    );
    await query('update public.user_timetables set customized = true where profile_id = $1', [s1?.id]);
    const [template] = await query<{ id: string }>("insert into public.schedule_templates (name) values ('שכבה') returning id");
    await query("insert into public.template_lessons (template_id, day, period_index, preset_id) values ($1, 'sun', 0, $2), ($1, 'mon', 1, $3)", [
      template?.id,
      math,
      chemistry,
    ]);

    const students = [s1?.id, s2?.id, s3?.id] as string[];
    const before = await timetablesOf(students);
    const libraryBefore = await query('select id, name, short_name, teacher, room, color, notes, archived_at from public.subject_presets order by id');
    const templateBefore = await query('select template_id, day, period_index, preset_id from public.template_lessons order by day, period_index');
    const timetablesBefore = await query('select profile_id, periods, customized, source_template_id from public.user_timetables order by profile_id');

    await runFile(path.join(MIGRATIONS_DIR, MIGRATION));

    // Every student sees exactly the same timetable.
    expect(await timetablesOf(students)).toEqual(before);
    expect(before[0]).toHaveLength(4);
    expect(before[1]).toHaveLength(2);
    // Every lesson now uses a preset owned by its own student.
    expect(await query('select 1 from public.lessons l join public.subject_presets sp on sp.id = l.preset_id where sp.profile_id is distinct from l.profile_id')).toEqual([]);
    // Pickable presets are exactly those that were assigned and active; the rest are kept but hidden.
    const owned = async (profileId: string, archived: boolean) =>
      (
        await query<{ name: string }>(
          `select name from public.subject_presets where profile_id = $1 and (archived_at is not null) = $2 order by name`,
          [profileId, archived],
        )
      ).map((r) => r.name);
    expect(await owned(students[0] as string, false)).toEqual(['אנגלית', 'מתמטיקה', 'רובוטיקה']);
    expect(await owned(students[0] as string, true)).toEqual(['היסטוריה']);
    expect(await owned(students[1] as string, false)).toEqual(['מתמטיקה']);
    expect(await owned(students[1] as string, true)).toEqual(['ישן']);
    expect(await owned(students[2] as string, false)).toEqual([]);
    expect(await owned(students[2] as string, true)).toEqual([]);
    // Copies remember the library preset they came from; nothing is shared between students.
    const copies = await query<{ id: string; profile_id: string; library_preset_id: string }>(
      'select id, profile_id, library_preset_id from public.subject_presets where profile_id is not null',
    );
    expect(copies).toHaveLength(6);
    expect(new Set(copies.map((c) => c.id)).size).toBe(6);
    expect(copies.filter((c) => c.library_preset_id === math).map((c) => c.profile_id).sort()).toEqual([students[0], students[1]].sort());

    // The shared presets remain as the admin's library, unchanged; templates are untouched.
    expect(await query('select id, name, short_name, teacher, room, color, notes, archived_at from public.subject_presets where profile_id is null order by id')).toEqual(
      libraryBefore,
    );
    expect(await query('select template_id, day, period_index, preset_id from public.template_lessons order by day, period_index')).toEqual(templateBefore);
    expect(await query('select profile_id, periods, customized, source_template_id from public.user_timetables order by profile_id')).toEqual(timetablesBefore);
    expect((await query<{ t: string | null }>("select to_regclass('public.profile_presets')::text as t"))[0]?.t).toBeNull();
  });
});

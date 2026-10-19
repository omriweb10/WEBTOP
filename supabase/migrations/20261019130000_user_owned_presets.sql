-- Per-user subject presets.
--
-- Before: one shared list of presets; profile_presets said which ones each student could
-- use, so editing a preset changed it for every student at once.
-- After: every preset belongs to exactly one student (profile_id), or to the admin-only
-- library (profile_id is null) that templates are built from and that subjects are copied
-- from. Copying always creates a new, independent row; nothing is shared between accounts.
-- A lesson can only reference a preset owned by the same student (composite foreign key),
-- so one student's presets can never appear in, or change, another student's timetable.
--
-- Existing data is migrated without loss: each student receives their own copy of every
-- preset that was assigned to them or placed in their timetable, and their lessons are
-- repointed to those copies. The shared presets stay as the library, templates unchanged.

-- 1. Ownership and origin columns.
alter table public.subject_presets
  add column profile_id uuid references public.profiles (id) on delete cascade,
  -- The library preset this one was copied from (provenance only, never a live link):
  -- lets a template assignment reuse the student's existing copy instead of duplicating it.
  add column library_preset_id uuid references public.subject_presets (id) on delete set null,
  add constraint subject_presets_library_has_no_origin check (profile_id is not null or library_preset_id is null),
  -- Target of the lessons' composite foreign key below.
  add constraint subject_presets_owner_key unique (profile_id, id);
create index subject_presets_by_owner on public.subject_presets (profile_id, name);
create index subject_presets_by_origin on public.subject_presets (library_preset_id) where library_preset_id is not null;

-- 2. One private copy per (student, preset) pair that was assigned or placed.
create temporary table preset_migration (
  profile_id uuid not null,
  library_id uuid not null,
  copy_id uuid not null default gen_random_uuid(),
  assigned boolean not null,
  primary key (profile_id, library_id)
);
insert into preset_migration (profile_id, library_id, assigned)
select profile_id, preset_id, bool_or(assigned)
  from (select profile_id, preset_id, true as assigned from public.profile_presets
        union all
        select profile_id, preset_id, false from public.lessons) pairs
 group by profile_id, preset_id;

-- A copy stays pickable only if the student could pick it before (assigned and not
-- archived); otherwise it is archived: still shown where it is placed, but not offered.
insert into public.subject_presets
  (id, profile_id, library_preset_id, name, short_name, teacher, room, color, notes, archived_at, created_at)
select m.copy_id, m.profile_id, sp.id, sp.name, sp.short_name, sp.teacher, sp.room, sp.color, sp.notes,
       case when m.assigned and sp.archived_at is null then null else coalesce(sp.archived_at, now()) end,
       sp.created_at
  from preset_migration m
  join public.subject_presets sp on sp.id = m.library_id;

-- 3. Lessons now point at their owner's copy; the composite key enforces ownership.
alter table public.lessons drop constraint lessons_preset_id_fkey;
update public.lessons l
   set preset_id = m.copy_id
  from preset_migration m
 where m.profile_id = l.profile_id and m.library_id = l.preset_id;
-- Deferred: checked at commit, so cascades (e.g. deleting a student) never trip over
-- their own order. A preset that is still placed can never be deleted.
alter table public.lessons
  add constraint lessons_preset_owned_fkey foreign key (profile_id, preset_id)
  references public.subject_presets (profile_id, id) deferrable initially deferred;

drop table preset_migration;

-- 4. The shared assignment table and its RPCs are replaced by ownership.
drop policy subject_presets_read_assigned on public.subject_presets;
drop function public.admin_set_profile_presets(uuid, uuid[]);
drop function public.admin_add_preset_to_profiles(uuid, uuid[]);
drop table public.profile_presets;

-- Templates are built from the library only.
create function private.check_template_preset()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if not exists (select 1 from public.subject_presets where id = new.preset_id and profile_id is null) then
    raise exception 'preset_not_in_library' using errcode = '22023';
  end if;
  return new;
end
$$;
create trigger template_lessons_library_preset before insert or update of preset_id on public.template_lessons
  for each row execute function private.check_template_preset();

-- 5. Row Level Security: a student reads only the presets they own. Only admins write
-- (subject_presets_admin_all); the owner and origin columns are never updatable, and
-- deletion goes through admin_remove_preset, which protects placed lessons.
create policy subject_presets_read_own on public.subject_presets for select to authenticated
  using (profile_id = (select public.current_profile_id()));
revoke insert, update, delete on public.subject_presets from authenticated;
grant insert (profile_id, name, short_name, teacher, room, color, notes) on public.subject_presets to authenticated;
grant update (name, short_name, teacher, room, color, notes, archived_at) on public.subject_presets to authenticated;

-- Presets with their usage, for the admin lists (security_invoker: RLS applies).
create view public.admin_preset_overview with (security_invoker = true) as
select sp.id, sp.profile_id, sp.library_preset_id, sp.name, sp.short_name, sp.teacher, sp.room, sp.color, sp.notes,
       sp.archived_at, sp.created_at, sp.updated_at,
       (select count(*) from public.lessons l where l.preset_id = sp.id)::integer as lesson_count,
       (select count(*) from public.template_lessons tl where tl.preset_id = sp.id)::integer as template_lesson_count
  from public.subject_presets sp;
revoke all on public.admin_preset_overview from anon;
grant select on public.admin_preset_overview to authenticated;

-- 6. Lesson writes: a preset can be placed only in its owner's timetable. Archived presets
-- cannot be newly placed, but lessons that already use one can still be moved or copied.
drop function private.apply_lesson_changes(uuid, jsonb, uuid[]);
create function private.apply_lesson_changes(p_profile_id uuid, p_changes jsonb)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_change jsonb;
  v_period_count integer;
  v_day text;
  v_index integer;
  v_preset uuid;
  v_owner uuid;
  v_archived timestamptz;
begin
  if p_changes is null or jsonb_typeof(p_changes) <> 'array' or jsonb_array_length(p_changes) > 65 then
    raise exception 'invalid_changes' using errcode = '22023';
  end if;
  select jsonb_array_length(t.periods) into v_period_count
    from public.user_timetables t where t.profile_id = p_profile_id for update;
  if not found then raise exception 'timetable_not_found' using errcode = 'P0002'; end if;

  -- Validate the whole batch first.
  for v_change in select value from jsonb_array_elements(p_changes) loop
    v_day := v_change ->> 'day';
    if v_day is null or v_day not in ('sun', 'mon', 'tue', 'wed', 'thu') then
      raise exception 'invalid_day' using errcode = '22023';
    end if;
    if jsonb_typeof(v_change -> 'period_index') <> 'number' then
      raise exception 'invalid_period' using errcode = '22023';
    end if;
    v_index := (v_change ->> 'period_index')::integer;
    if v_index < 0 or v_index >= v_period_count then
      raise exception 'invalid_period' using errcode = '22023';
    end if;
    v_preset := nullif(v_change ->> 'preset_id', '')::uuid;
    if v_preset is not null then
      v_owner := null;
      select sp.profile_id, sp.archived_at into v_owner, v_archived from public.subject_presets sp where sp.id = v_preset;
      if v_owner is distinct from p_profile_id then
        raise exception 'preset_not_assigned' using errcode = '42501';
      end if;
      if v_archived is not null
         and not exists (select 1 from public.lessons l where l.profile_id = p_profile_id and l.preset_id = v_preset) then
        raise exception 'preset_unavailable' using errcode = '22023';
      end if;
    end if;
  end loop;

  -- Then apply it.
  for v_change in select value from jsonb_array_elements(p_changes) loop
    v_day := v_change ->> 'day';
    v_index := (v_change ->> 'period_index')::integer;
    v_preset := nullif(v_change ->> 'preset_id', '')::uuid;
    if v_preset is null then
      delete from public.lessons where profile_id = p_profile_id and day = v_day and period_index = v_index;
    else
      insert into public.lessons (profile_id, day, period_index, preset_id)
      values (p_profile_id, v_day, v_index, v_preset)
      on conflict (profile_id, day, period_index)
      do update set preset_id = excluded.preset_id, updated_at = now();
    end if;
  end loop;

  update public.user_timetables set customized = true where profile_id = p_profile_id;
end
$$;

-- The student saves into their own timetable, with their own presets only.
create or replace function public.save_my_lessons(p_changes jsonb)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_profile uuid := private.require_student();
begin
  perform private.apply_lesson_changes(v_profile, p_changes);
  return private.lessons_json(v_profile);
end
$$;

-- The admin edits a student's lessons, with that student's presets only.
create or replace function public.admin_save_user_lessons(p_profile_id uuid, p_changes jsonb)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
begin
  perform private.require_admin();
  perform private.apply_lesson_changes(p_profile_id, p_changes);
  return private.lessons_json(p_profile_id);
end
$$;

-- 7. The student's snapshot: their own presets (pickable unless archived) and nothing else.
create or replace function public.get_my_bundle()
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  v_profile uuid := private.require_student();
begin
  return jsonb_build_object(
    'profile', (select jsonb_build_object('id', p.id, 'display_name', p.display_name, 'class_name', p.class_name,
                         'school_name', p.school_name, 'bio', p.bio, 'avatar_path', p.avatar_path, 'updated_at', p.updated_at)
                  from public.profiles p where p.id = v_profile),
    'session', public.get_my_session(),
    'timetable', (select jsonb_build_object('periods', t.periods, 'customized', t.customized, 'updated_at', t.updated_at)
                    from public.user_timetables t where t.profile_id = v_profile),
    'lessons', private.lessons_json(v_profile),
    'presets', (select coalesce(jsonb_agg(jsonb_build_object(
                    'id', sp.id, 'name', sp.name, 'short_name', sp.short_name, 'teacher', sp.teacher, 'room', sp.room,
                    'color', sp.color, 'notes', sp.notes, 'archived', sp.archived_at is not null,
                    'assigned', sp.archived_at is null)
                    order by sp.name), '[]'::jsonb)
                  from public.subject_presets sp
                  where sp.profile_id = v_profile
                    and (sp.archived_at is null
                         or exists (select 1 from public.lessons l where l.profile_id = v_profile and l.preset_id = sp.id))),
    'events', (select coalesce(jsonb_agg(jsonb_build_object('id', e.id, 'kind', e.kind, 'title', e.title, 'date', e.date,
                    'time', e.time, 'group_name', e.group_name, 'notes', e.notes) order by e.date, e.time), '[]'::jsonb)
                 from public.events e where e.profile_id is null or e.profile_id = v_profile),
    'notifications', (select coalesce(jsonb_agg(jsonb_build_object('id', n.id, 'category', n.category, 'title', n.title,
                    'body', n.body, 'date', n.date, 'created_at', n.created_at) order by n.created_at desc), '[]'::jsonb)
                 from public.notifications n where n.profile_id is null or n.profile_id = v_profile)
  );
end
$$;

-- 8. Admin operations on presets.

-- Copies presets (from the library or from any student) into each target student's own
-- list as new, independent rows; later edits on either side never affect the other.
-- A preset is never copied into its own owner's list (use the editor to duplicate).
-- Returns the number of presets created.
create function public.admin_copy_presets(p_preset_ids uuid[], p_profile_ids uuid[])
returns integer
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_count integer;
begin
  perform private.require_admin();
  if coalesce(cardinality(p_preset_ids), 0) > 200 or coalesce(cardinality(p_profile_ids), 0) > 1000 then
    raise exception 'too_many_items' using errcode = '22023';
  end if;
  insert into public.subject_presets (profile_id, library_preset_id, name, short_name, teacher, room, color, notes)
  select target.id,
         case when src.profile_id is null then src.id else src.library_preset_id end,
         src.name, src.short_name, src.teacher, src.room, src.color, src.notes
    from public.subject_presets src
    join public.profiles target on target.id = any (p_profile_ids)
   where src.id = any (p_preset_ids)
     and src.profile_id is distinct from target.id
   order by target.id, src.name;
  get diagnostics v_count = row_count;
  return v_count;
end
$$;

-- Removes a preset. A student's preset that is still placed in their timetable is removed
-- only when the admin chose what happens to those lessons: 'replace' moves them to another
-- (non-archived) preset of the same student, 'delete' empties those periods. Without a
-- choice it raises preset_in_use, so lessons are never deleted silently. A library preset
-- used by a template cannot be removed (archive it instead). Returns the lessons affected.
create function public.admin_remove_preset(p_preset_id uuid, p_lessons text default null, p_replacement_id uuid default null)
returns integer
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_owner uuid;
  v_used integer;
begin
  perform private.require_admin();
  select profile_id into v_owner from public.subject_presets where id = p_preset_id;
  if not found then raise exception 'preset_not_found' using errcode = 'P0002'; end if;
  -- Same lock order as lesson writes (timetable, then preset), so they cannot deadlock.
  if v_owner is not null then
    perform 1 from public.user_timetables where profile_id = v_owner for update;
  end if;
  perform 1 from public.subject_presets where id = p_preset_id for update;

  if v_owner is null then
    if exists (select 1 from public.template_lessons where preset_id = p_preset_id) then
      raise exception 'preset_in_template' using errcode = '23503';
    end if;
    delete from public.subject_presets where id = p_preset_id;
    return 0;
  end if;

  select count(*) into v_used from public.lessons where profile_id = v_owner and preset_id = p_preset_id;
  if v_used > 0 then
    if p_lessons = 'replace' then
      if p_replacement_id is null or p_replacement_id = p_preset_id or not exists (
           select 1 from public.subject_presets
            where id = p_replacement_id and profile_id = v_owner and archived_at is null) then
        raise exception 'invalid_replacement' using errcode = '22023';
      end if;
      update public.lessons set preset_id = p_replacement_id, updated_at = now()
       where profile_id = v_owner and preset_id = p_preset_id;
    elsif p_lessons = 'delete' then
      delete from public.lessons where profile_id = v_owner and preset_id = p_preset_id;
    else
      raise exception 'preset_in_use' using errcode = '23503', detail = v_used::text;
    end if;
    update public.user_timetables set customized = true where profile_id = v_owner;
  end if;
  delete from public.subject_presets where id = p_preset_id;
  return v_used;
end
$$;

-- Copies a template into each student's timetable. Its library presets become the
-- student's own copies: an existing, non-archived copy of the same library preset is
-- reused (keeping any teacher/room the admin set for that student), otherwise a new copy
-- is created. Customised timetables are skipped unless p_overwrite_customized is true.
create or replace function public.admin_assign_template(p_template_id uuid, p_profile_ids uuid[], p_overwrite_customized boolean)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_template record;
  v_profile uuid;
  v_customized boolean;
  v_assigned uuid[] := '{}';
  v_skipped uuid[] := '{}';
begin
  perform private.require_admin();
  select id, periods into v_template from public.schedule_templates where id = p_template_id;
  if not found then raise exception 'template_not_found' using errcode = 'P0002'; end if;

  foreach v_profile in array coalesce(p_profile_ids, '{}') loop
    select customized into v_customized from public.user_timetables where profile_id = v_profile for update;
    if not found then continue; end if;
    if v_customized and not p_overwrite_customized then
      v_skipped := v_skipped || v_profile;
      continue;
    end if;

    insert into public.subject_presets (profile_id, library_preset_id, name, short_name, teacher, room, color, notes)
    select v_profile, lib.id, lib.name, lib.short_name, lib.teacher, lib.room, lib.color, lib.notes
      from public.subject_presets lib
     where lib.id in (select tl.preset_id from public.template_lessons tl where tl.template_id = v_template.id)
       and not exists (select 1 from public.subject_presets own
                        where own.profile_id = v_profile and own.library_preset_id = lib.id and own.archived_at is null);

    delete from public.lessons where profile_id = v_profile;
    update public.user_timetables
       set periods = v_template.periods, source_template_id = v_template.id, customized = false
     where profile_id = v_profile;
    insert into public.lessons (profile_id, day, period_index, preset_id)
    select v_profile, tl.day, tl.period_index,
           (select own.id from public.subject_presets own
             where own.profile_id = v_profile and own.library_preset_id = tl.preset_id and own.archived_at is null
             order by own.created_at, own.id limit 1)
      from public.template_lessons tl
     where tl.template_id = v_template.id;
    v_assigned := v_assigned || v_profile;
  end loop;
  return jsonb_build_object('assigned', to_jsonb(v_assigned), 'skipped_customized', to_jsonb(v_skipped));
end
$$;

revoke all on function public.admin_copy_presets(uuid[], uuid[]) from public, anon;
revoke all on function public.admin_remove_preset(uuid, text, uuid) from public, anon;
grant execute on function public.admin_copy_presets(uuid[], uuid[]) to authenticated;
grant execute on function public.admin_remove_preset(uuid, text, uuid) to authenticated;

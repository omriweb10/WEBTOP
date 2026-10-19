-- Administrator RPCs for operations that must be atomic or touch protected tables.
-- Every function verifies is_admin() itself (server-side authorization).

create function private.require_admin()
returns void
language plpgsql
stable
security definer
set search_path = ''
as $$
begin
  if not public.is_admin() then
    raise exception 'admin_required' using errcode = '42501';
  end if;
end
$$;

-- Force Disconnect: ends a session and revokes its refresh tokens, freeing the code.
create function public.admin_disconnect_session(p_session_id uuid)
returns boolean
language plpgsql
security definer
set search_path = ''
as $$
begin
  perform private.require_admin();
  if not exists (select 1 from public.user_sessions where id = p_session_id and status <> 'ended') then
    return false;
  end if;
  perform private.end_session(p_session_id, 'admin_disconnect');
  return true;
end
$$;

-- Revokes an access code (its live session ends immediately).
create function public.admin_revoke_access_code(p_code_id uuid)
returns boolean
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_profile uuid;
begin
  perform private.require_admin();
  select profile_id into v_profile from public.access_codes where id = p_code_id and status = 'active' for update;
  if not found then return false; end if;
  perform private.end_live_sessions(v_profile, p_code_id, 'code_revoked');
  update public.access_codes set status = 'revoked', revoked_at = now() where id = p_code_id;
  return true;
end
$$;

-- Activates or disables an account; disabling ends its sessions.
create function public.admin_set_profile_status(p_profile_id uuid, p_status public.account_status)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  perform private.require_admin();
  update public.profiles set status = p_status where id = p_profile_id;
  if not found then raise exception 'profile_not_found' using errcode = 'P0002'; end if;
  if p_status = 'disabled' then
    perform private.end_live_sessions(p_profile_id, null, 'account_disabled');
  end if;
end
$$;

-- Deletes a student completely (sessions, auth identity, codes, timetable, content).
-- Returns the avatar path so the caller can remove the stored image.
create function public.admin_delete_profile(p_profile_id uuid)
returns text
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_profile record;
begin
  perform private.require_admin();
  select id, auth_user_id, avatar_path into v_profile from public.profiles where id = p_profile_id for update;
  if not found then raise exception 'profile_not_found' using errcode = 'P0002'; end if;
  perform private.end_live_sessions(p_profile_id, null, 'account_deleted');
  delete from public.profiles where id = p_profile_id;
  if v_profile.auth_user_id is not null then
    delete from auth.users where id = v_profile.auth_user_id;
  end if;
  return v_profile.avatar_path;
end
$$;

-- Replaces the set of presets a student may use. Existing lessons are left untouched.
create function public.admin_set_profile_presets(p_profile_id uuid, p_preset_ids uuid[])
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  perform private.require_admin();
  delete from public.profile_presets
   where profile_id = p_profile_id and not (preset_id = any (coalesce(p_preset_ids, '{}')));
  insert into public.profile_presets (profile_id, preset_id)
  select p_profile_id, unnest(coalesce(p_preset_ids, '{}'))
  on conflict do nothing;
end
$$;

-- Makes one preset available to several students at once.
create function public.admin_add_preset_to_profiles(p_preset_id uuid, p_profile_ids uuid[])
returns integer
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_count integer;
begin
  perform private.require_admin();
  insert into public.profile_presets (profile_id, preset_id)
  select unnest(coalesce(p_profile_ids, '{}')), p_preset_id
  on conflict do nothing;
  get diagnostics v_count = row_count;
  return v_count;
end
$$;

-- Edits a student's lessons as the admin; placed presets become available to them.
create function public.admin_save_user_lessons(p_profile_id uuid, p_changes jsonb)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
begin
  perform private.require_admin();
  perform private.apply_lesson_changes(p_profile_id, p_changes, null);
  insert into public.profile_presets (profile_id, preset_id)
  select distinct p_profile_id, nullif(c ->> 'preset_id', '')::uuid
    from jsonb_array_elements(p_changes) c
   where nullif(c ->> 'preset_id', '') is not null
  on conflict do nothing;
  return private.lessons_json(p_profile_id);
end
$$;

-- Changes a student's bell schedule; lessons beyond the new last period are removed.
create function public.admin_set_user_periods(p_profile_id uuid, p_periods jsonb)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  perform private.require_admin();
  if not private.is_valid_periods(p_periods) then
    raise exception 'invalid_periods' using errcode = '22023';
  end if;
  delete from public.lessons where profile_id = p_profile_id and period_index >= jsonb_array_length(p_periods);
  update public.user_timetables set periods = p_periods, customized = true where profile_id = p_profile_id;
  if not found then raise exception 'timetable_not_found' using errcode = 'P0002'; end if;
end
$$;

-- Creates or fully replaces a weekly template (name, bell times, lessons) atomically.
create function public.admin_save_template(p_template_id uuid, p_name text, p_periods jsonb, p_lessons jsonb)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_id uuid := p_template_id;
  v_lesson jsonb;
begin
  perform private.require_admin();
  if not private.is_valid_periods(p_periods) then
    raise exception 'invalid_periods' using errcode = '22023';
  end if;
  if p_lessons is null or jsonb_typeof(p_lessons) <> 'array' then
    raise exception 'invalid_lessons' using errcode = '22023';
  end if;
  if v_id is null then
    insert into public.schedule_templates (name, periods) values (btrim(p_name), p_periods) returning id into v_id;
  else
    update public.schedule_templates set name = btrim(p_name), periods = p_periods where id = v_id;
    if not found then raise exception 'template_not_found' using errcode = 'P0002'; end if;
    delete from public.template_lessons where template_id = v_id;
  end if;
  for v_lesson in select value from jsonb_array_elements(p_lessons) loop
    insert into public.template_lessons (template_id, day, period_index, preset_id)
    values (v_id, v_lesson ->> 'day', (v_lesson ->> 'period_index')::smallint, (v_lesson ->> 'preset_id')::uuid);
  end loop;
  return v_id;
end
$$;

-- Copies a template under a new name.
create function public.admin_duplicate_template(p_template_id uuid, p_name text)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_id uuid;
begin
  perform private.require_admin();
  insert into public.schedule_templates (name, periods)
  select btrim(p_name), periods from public.schedule_templates where id = p_template_id
  returning id into v_id;
  if v_id is null then raise exception 'template_not_found' using errcode = 'P0002'; end if;
  insert into public.template_lessons (template_id, day, period_index, preset_id)
  select v_id, day, period_index, preset_id from public.template_lessons where template_id = p_template_id;
  return v_id;
end
$$;

-- Lists which of the given students already customised their timetable (for the
-- confirmation shown before a template overwrites them).
create function public.admin_template_assignment_preview(p_template_id uuid, p_profile_ids uuid[])
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
begin
  perform private.require_admin();
  return (select coalesce(jsonb_agg(jsonb_build_object('id', p.id, 'display_name', p.display_name)
                                    order by p.display_name), '[]'::jsonb)
            from public.user_timetables t join public.profiles p on p.id = t.profile_id
           where t.profile_id = any (coalesce(p_profile_ids, '{}')) and t.customized);
end
$$;

-- Copies a template into each student's own timetable. Customised timetables are
-- skipped unless p_overwrite_customized is true (the admin confirmed it explicitly).
-- The template's presets become available to the students.
create function public.admin_assign_template(p_template_id uuid, p_profile_ids uuid[], p_overwrite_customized boolean)
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
    delete from public.lessons where profile_id = v_profile;
    update public.user_timetables
       set periods = v_template.periods, source_template_id = v_template.id, customized = false
     where profile_id = v_profile;
    insert into public.lessons (profile_id, day, period_index, preset_id)
    select v_profile, day, period_index, preset_id from public.template_lessons where template_id = v_template.id;
    insert into public.profile_presets (profile_id, preset_id)
    select distinct v_profile, preset_id from public.template_lessons where template_id = v_template.id
    on conflict do nothing;
    v_assigned := v_assigned || v_profile;
  end loop;
  return jsonb_build_object('assigned', to_jsonb(v_assigned), 'skipped_customized', to_jsonb(v_skipped));
end
$$;

-- Admin overviews (security_invoker: the caller's RLS applies, so only admins see rows).
create view public.admin_user_overview with (security_invoker = true) as
select p.id, p.display_name, p.class_name, p.school_name, p.bio, p.avatar_path, p.status, p.created_at, p.updated_at,
       c.id as code_id, c.code_hint, c.strength_bits, c.created_at as code_created_at, c.last_used_at as code_last_used_at,
       s.id as session_id, s.status as session_status, s.activated_at as session_started_at,
       s.last_seen_at as session_last_seen_at, s.device_label as session_device,
       t.source_template_id, t.customized as timetable_customized
  from public.profiles p
  left join public.access_codes c on c.profile_id = p.id and c.status = 'active'
  left join public.user_sessions s on s.profile_id = p.id and s.status = 'active'
  left join public.user_timetables t on t.profile_id = p.id;

create view public.admin_session_overview with (security_invoker = true) as
select s.id, s.profile_id, p.display_name, p.class_name, p.avatar_path, p.status as profile_status,
       s.status, s.device_label, s.created_at, s.activated_at, s.last_seen_at, s.ended_at, s.end_reason,
       s.access_code_id, c.code_hint, c.status as code_status
  from public.user_sessions s
  join public.profiles p on p.id = s.profile_id
  join public.access_codes c on c.id = s.access_code_id;

revoke all on public.admin_user_overview, public.admin_session_overview from anon;
grant select on public.admin_user_overview, public.admin_session_overview to authenticated;

do $$
declare
  fn text;
begin
  foreach fn in array array[
    'admin_disconnect_session(uuid)', 'admin_revoke_access_code(uuid)',
    'admin_set_profile_status(uuid, public.account_status)', 'admin_delete_profile(uuid)',
    'admin_set_profile_presets(uuid, uuid[])', 'admin_add_preset_to_profiles(uuid, uuid[])',
    'admin_save_user_lessons(uuid, jsonb)', 'admin_set_user_periods(uuid, jsonb)',
    'admin_save_template(uuid, text, jsonb, jsonb)', 'admin_duplicate_template(uuid, text)',
    'admin_template_assignment_preview(uuid, uuid[])', 'admin_assign_template(uuid, uuid[], boolean)'
  ] loop
    execute format('revoke all on function public.%s from public, anon', fn);
    execute format('grant execute on function public.%s to authenticated', fn);
  end loop;
end
$$;

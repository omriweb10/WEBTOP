-- RPCs used by signed-in students. Each one re-derives the student from the live
-- session (current_profile_id()) and never trusts identifiers sent by the client.

-- Raises the standard "session no longer valid" error (HTTP 403 via PostgREST).
create function private.require_student()
returns uuid
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  v_profile uuid := public.current_profile_id();
begin
  if v_profile is null then
    raise exception 'session_inactive' using errcode = '42501';
  end if;
  return v_profile;
end
$$;

-- The caller's live session, or NULL when it has ended (used at app start).
create function public.get_my_session()
returns jsonb
language sql
stable
security definer
set search_path = ''
as $$
  select jsonb_build_object('session_id', s.id, 'profile_id', s.profile_id,
                            'started_at', s.activated_at, 'last_seen_at', s.last_seen_at)
  from public.user_sessions s
  where s.status = 'active'
    and s.profile_id = public.current_profile_id()
    and s.auth_session_id = nullif(auth.jwt() ->> 'session_id', '')::uuid
$$;

-- Records activity for the admin's "connected" indicator. Never expires anything.
create function public.touch_my_session()
returns boolean
language plpgsql
security definer
set search_path = ''
as $$
begin
  if public.current_profile_id() is null then return false; end if;
  update public.user_sessions
     set last_seen_at = now()
   where status = 'active'
     and auth_session_id = nullif(auth.jwt() ->> 'session_id', '')::uuid
     and (last_seen_at is null or last_seen_at < now() - interval '15 seconds');
  return true;
end
$$;

-- Explicit logout: ends the caller's session so the code can be used on another device.
create function public.end_my_session()
returns boolean
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_id uuid;
begin
  select s.id into v_id
    from public.user_sessions s
    join public.profiles p on p.id = s.profile_id
   where s.status <> 'ended'
     and s.auth_session_id = nullif(auth.jwt() ->> 'session_id', '')::uuid
     and p.auth_user_id = auth.uid();
  if v_id is null then return false; end if;
  perform private.end_session(v_id, 'logout');
  return true;
end
$$;

-- Everything the student app needs in one consistent snapshot.
create function public.get_my_bundle()
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
                    'assigned', exists (select 1 from public.profile_presets pp where pp.profile_id = v_profile and pp.preset_id = sp.id))
                    order by sp.name), '[]'::jsonb)
                  from public.subject_presets sp
                  where sp.id in (select pp.preset_id from public.profile_presets pp where pp.profile_id = v_profile
                                  union select l.preset_id from public.lessons l where l.profile_id = v_profile)),
    'events', (select coalesce(jsonb_agg(jsonb_build_object('id', e.id, 'kind', e.kind, 'title', e.title, 'date', e.date,
                    'time', e.time, 'group_name', e.group_name, 'notes', e.notes) order by e.date, e.time), '[]'::jsonb)
                 from public.events e where e.profile_id is null or e.profile_id = v_profile),
    'notifications', (select coalesce(jsonb_agg(jsonb_build_object('id', n.id, 'category', n.category, 'title', n.title,
                    'body', n.body, 'date', n.date, 'created_at', n.created_at) order by n.created_at desc), '[]'::jsonb)
                 from public.notifications n where n.profile_id is null or n.profile_id = v_profile)
  );
end
$$;

-- Saves the student's own lesson changes. Allowed presets: those the admin assigned
-- (and not archived) plus presets already placed in the student's timetable, so
-- existing lessons can still be moved or copied.
create function public.save_my_lessons(p_changes jsonb)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_profile uuid := private.require_student();
  v_allowed uuid[];
begin
  select coalesce(array_agg(distinct preset_id), '{}') into v_allowed from (
    select pp.preset_id from public.profile_presets pp
      join public.subject_presets sp on sp.id = pp.preset_id
     where pp.profile_id = v_profile and sp.archived_at is null
    union
    select l.preset_id from public.lessons l where l.profile_id = v_profile
  ) allowed;
  perform private.apply_lesson_changes(v_profile, p_changes, v_allowed);
  return private.lessons_json(v_profile);
end
$$;

revoke all on function public.get_my_session() from public, anon;
revoke all on function public.touch_my_session() from public, anon;
revoke all on function public.end_my_session() from public, anon;
revoke all on function public.get_my_bundle() from public, anon;
revoke all on function public.save_my_lessons(jsonb) from public, anon;
grant execute on function public.get_my_session() to authenticated;
grant execute on function public.touch_my_session() to authenticated;
grant execute on function public.end_my_session() to authenticated;
grant execute on function public.get_my_bundle() to authenticated;
grant execute on function public.save_my_lessons(jsonb) to authenticated;

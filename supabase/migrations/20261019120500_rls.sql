-- Row Level Security and table privileges.
-- Principles: anon gets nothing; students read only their own data and only through a
-- live session (current_profile_id()); every write by a student goes through validated
-- RPCs; admins (is_admin()) manage everything. Sensitive writes use RPCs only.

alter table public.admins enable row level security;
alter table public.profiles enable row level security;
alter table public.access_codes enable row level security;
alter table public.user_sessions enable row level security;
alter table public.subject_presets enable row level security;
alter table public.profile_presets enable row level security;
alter table public.schedule_templates enable row level security;
alter table public.template_lessons enable row level security;
alter table public.user_timetables enable row level security;
alter table public.lessons enable row level security;
alter table public.events enable row level security;
alter table public.notifications enable row level security;

-- Start from zero for API roles, then grant exactly what each role needs.
revoke all on all tables in schema public from anon, authenticated;

grant select on public.admins to authenticated;
grant select on public.profiles to authenticated;
-- Status changes go through admin_set_profile_status (which also ends sessions) and the
-- link to the auth user is managed by the server only, so neither column is writable.
grant insert (display_name, class_name, school_name, bio) on public.profiles to authenticated;
grant update (display_name, class_name, school_name, bio, avatar_path) on public.profiles to authenticated;
-- code_hash is never readable through the API, not even by admins.
grant select (id, profile_id, code_hint, strength_bits, status, created_at, revoked_at, last_used_at)
  on public.access_codes to authenticated;
grant select on public.user_sessions to authenticated;
grant select, insert, update, delete on public.subject_presets to authenticated;
grant select, insert, delete on public.profile_presets to authenticated;
grant select, delete on public.schedule_templates to authenticated;
grant select on public.template_lessons to authenticated;
grant select on public.user_timetables to authenticated;
grant select on public.lessons to authenticated;
grant select, insert, update, delete on public.events to authenticated;
grant select, insert, update, delete on public.notifications to authenticated;

-- admins: an admin can see the admin list; anyone can see whether they are one.
create policy admins_read on public.admins for select to authenticated
  using (user_id = (select auth.uid()) or (select public.is_admin()));

-- profiles
create policy profiles_admin_all on public.profiles for all to authenticated
  using ((select public.is_admin())) with check ((select public.is_admin()));
create policy profiles_read_own on public.profiles for select to authenticated
  using (id = (select public.current_profile_id()));

-- access codes and sessions: admin overview; a student sees only their live session.
create policy access_codes_admin_read on public.access_codes for select to authenticated
  using ((select public.is_admin()));
create policy user_sessions_admin_read on public.user_sessions for select to authenticated
  using ((select public.is_admin()));
create policy user_sessions_read_own on public.user_sessions for select to authenticated
  using (profile_id = (select public.current_profile_id())
         and auth_session_id = nullif((select auth.jwt()) ->> 'session_id', '')::uuid);

-- presets: admins manage; a student reads the presets assigned to them or used in their timetable.
create policy subject_presets_admin_all on public.subject_presets for all to authenticated
  using ((select public.is_admin())) with check ((select public.is_admin()));
create policy subject_presets_read_assigned on public.subject_presets for select to authenticated
  using (
    exists (select 1 from public.profile_presets pp
             where pp.preset_id = subject_presets.id and pp.profile_id = (select public.current_profile_id()))
    or exists (select 1 from public.lessons l
                where l.preset_id = subject_presets.id and l.profile_id = (select public.current_profile_id()))
  );

create policy profile_presets_admin_all on public.profile_presets for all to authenticated
  using ((select public.is_admin())) with check ((select public.is_admin()));
create policy profile_presets_read_own on public.profile_presets for select to authenticated
  using (profile_id = (select public.current_profile_id()));

-- templates: admin only.
create policy schedule_templates_admin_all on public.schedule_templates for all to authenticated
  using ((select public.is_admin())) with check ((select public.is_admin()));
create policy template_lessons_admin_all on public.template_lessons for all to authenticated
  using ((select public.is_admin())) with check ((select public.is_admin()));

-- timetables and lessons: read own / admin; writes only through RPCs.
create policy user_timetables_admin_read on public.user_timetables for select to authenticated
  using ((select public.is_admin()));
create policy user_timetables_read_own on public.user_timetables for select to authenticated
  using (profile_id = (select public.current_profile_id()));
create policy lessons_admin_read on public.lessons for select to authenticated
  using ((select public.is_admin()));
create policy lessons_read_own on public.lessons for select to authenticated
  using (profile_id = (select public.current_profile_id()));

-- content: admins manage; students read items for everyone or for themselves.
create policy events_admin_all on public.events for all to authenticated
  using ((select public.is_admin())) with check ((select public.is_admin()));
create policy events_read_own on public.events for select to authenticated
  using ((select public.current_profile_id()) is not null
         and (profile_id is null or profile_id = (select public.current_profile_id())));
create policy notifications_admin_all on public.notifications for all to authenticated
  using ((select public.is_admin())) with check ((select public.is_admin()));
create policy notifications_read_own on public.notifications for select to authenticated
  using ((select public.current_profile_id()) is not null
         and (profile_id is null or profile_id = (select public.current_profile_id())));

-- Functions are executable by PUBLIC by default in PostgreSQL; lock that down.
alter default privileges in schema public revoke execute on functions from public, anon;

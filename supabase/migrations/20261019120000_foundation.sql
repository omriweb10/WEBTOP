-- Foundation: private schema, enums, shared validation helpers and triggers.

create extension if not exists pgcrypto with schema extensions;

-- Internal objects that must never be reachable through the REST API.
create schema if not exists private;
revoke all on schema private from public;

create type public.account_status as enum ('active', 'disabled');
create type public.code_status as enum ('active', 'revoked');
create type public.session_status as enum ('pending', 'active', 'ended');
create type public.session_end_reason as enum (
  'logout', 'admin_disconnect', 'code_revoked', 'account_disabled', 'account_deleted', 'login_aborted'
);
create type public.event_kind as enum ('exam', 'event');
create type public.notice_category as enum ('general', 'change');

-- A school day of the Sunday–Thursday week.
create domain public.school_day as text check (value in ('sun', 'mon', 'tue', 'wed', 'thu'));

-- Converts "H:MM" / "HH:MM" to minutes since midnight (null when malformed).
create function private.time_to_minutes(t text)
returns integer
language sql
immutable
as $$
  select case
    when t ~ '^([01]?[0-9]|2[0-3]):[0-5][0-9]$'
      then split_part(t, ':', 1)::integer * 60 + split_part(t, ':', 2)::integer
  end
$$;

-- Validates a bell schedule: 1–13 periods {number,start,end}, start < end, no overlaps.
create function private.is_valid_periods(p jsonb)
returns boolean
language plpgsql
immutable
as $$
declare
  item jsonb;
  start_min integer;
  end_min integer;
  previous_end integer := -1;
begin
  if p is null or jsonb_typeof(p) <> 'array' then return false; end if;
  if jsonb_array_length(p) not between 1 and 13 then return false; end if;
  for item in select value from jsonb_array_elements(p) loop
    if jsonb_typeof(item) <> 'object' or jsonb_typeof(item -> 'number') <> 'number' then return false; end if;
    if (item ->> 'number')::numeric not between 1 and 99 then return false; end if;
    start_min := private.time_to_minutes(item ->> 'start');
    end_min := private.time_to_minutes(item ->> 'end');
    if start_min is null or end_min is null or start_min >= end_min or start_min < previous_end then
      return false;
    end if;
    previous_end := end_min;
  end loop;
  return true;
end
$$;

-- The default bell schedule (13 periods) used for new timetables and templates.
create function private.default_periods()
returns jsonb
language sql
immutable
as $$
  select '[
    {"number":1,"start":"8:00","end":"8:50"},{"number":2,"start":"8:55","end":"9:40"},
    {"number":3,"start":"9:50","end":"10:35"},{"number":4,"start":"10:55","end":"11:40"},
    {"number":5,"start":"11:50","end":"12:35"},{"number":6,"start":"12:45","end":"13:30"},
    {"number":7,"start":"13:40","end":"14:25"},{"number":8,"start":"14:25","end":"15:10"},
    {"number":9,"start":"15:15","end":"16:00"},{"number":10,"start":"16:00","end":"16:45"},
    {"number":11,"start":"16:45","end":"17:30"},{"number":12,"start":"17:40","end":"18:25"},
    {"number":13,"start":"18:25","end":"19:10"}
  ]'::jsonb
$$;

-- Keeps updated_at current on every UPDATE.
create function private.set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at := now();
  return new;
end
$$;

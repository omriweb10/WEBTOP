-- Admin-managed content shown to students: events/exams and notices ("notifications").
-- profile_id NULL = visible to every student; otherwise only to that student.

create table public.events (
  id uuid primary key default gen_random_uuid(),
  profile_id uuid references public.profiles (id) on delete cascade,
  kind public.event_kind not null,
  title text not null check (char_length(btrim(title)) between 1 and 120),
  date date not null,
  time text check (time is null or time ~ '^([01]?[0-9]|2[0-3]):[0-5][0-9]$'),
  group_name text not null default '' check (char_length(group_name) <= 80),
  notes text not null default '' check (char_length(notes) <= 2000),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index events_by_profile on public.events (profile_id, date);
create trigger events_updated_at before update on public.events
  for each row execute function private.set_updated_at();

create table public.notifications (
  id uuid primary key default gen_random_uuid(),
  profile_id uuid references public.profiles (id) on delete cascade,
  category public.notice_category not null,
  title text not null check (char_length(btrim(title)) between 1 and 120),
  body text not null default '' check (char_length(body) <= 2000),
  date date,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index notifications_by_profile on public.notifications (profile_id, created_at desc);
create trigger notifications_updated_at before update on public.notifications
  for each row execute function private.set_updated_at();

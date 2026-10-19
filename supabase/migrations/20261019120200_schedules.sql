-- Schedules: subject presets, per-user preset availability, templates, user timetables, lessons.

create table public.subject_presets (
  id uuid primary key default gen_random_uuid(),
  -- Text shown on lesson cards, e.g. "מתמטיקה 4 (רמה: 4 יח``ל)".
  name text not null check (char_length(btrim(name)) between 1 and 80),
  -- Optional short label for the picker chips (falls back to name).
  short_name text not null default '' check (char_length(short_name) <= 40),
  teacher text not null default '' check (char_length(teacher) <= 80),
  room text not null default '' check (char_length(room) <= 80),
  color text not null check (color ~ '^#[0-9a-fA-F]{6}$'),
  notes text not null default '' check (char_length(notes) <= 300),
  -- Archived presets stay visible in existing lessons but can no longer be picked.
  archived_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create trigger subject_presets_updated_at before update on public.subject_presets
  for each row execute function private.set_updated_at();

-- Which presets each student may use when building their own timetable.
create table public.profile_presets (
  profile_id uuid not null references public.profiles (id) on delete cascade,
  preset_id uuid not null references public.subject_presets (id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (profile_id, preset_id)
);
create index profile_presets_by_preset on public.profile_presets (preset_id);

create table public.schedule_templates (
  id uuid primary key default gen_random_uuid(),
  name text not null check (char_length(btrim(name)) between 1 and 60),
  periods jsonb not null default private.default_periods() check (private.is_valid_periods(periods)),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create trigger schedule_templates_updated_at before update on public.schedule_templates
  for each row execute function private.set_updated_at();

create table public.template_lessons (
  template_id uuid not null references public.schedule_templates (id) on delete cascade,
  day public.school_day not null,
  period_index smallint not null check (period_index between 0 and 12),
  -- RESTRICT: a preset in use cannot be hard-deleted (archive it instead).
  preset_id uuid not null references public.subject_presets (id) on delete restrict,
  primary key (template_id, day, period_index)
);
create index template_lessons_by_preset on public.template_lessons (preset_id);

-- Each student's own timetable (bell times + whether it diverged from its template).
create table public.user_timetables (
  profile_id uuid primary key references public.profiles (id) on delete cascade,
  periods jsonb not null default private.default_periods() check (private.is_valid_periods(periods)),
  source_template_id uuid references public.schedule_templates (id) on delete set null,
  customized boolean not null default false,
  updated_at timestamptz not null default now()
);
create trigger user_timetables_updated_at before update on public.user_timetables
  for each row execute function private.set_updated_at();

-- One row per filled period; an absent row is an empty period.
create table public.lessons (
  profile_id uuid not null references public.user_timetables (profile_id) on delete cascade,
  day public.school_day not null,
  period_index smallint not null check (period_index between 0 and 12),
  preset_id uuid not null references public.subject_presets (id) on delete restrict,
  updated_at timestamptz not null default now(),
  primary key (profile_id, day, period_index)
);
create index lessons_by_preset on public.lessons (preset_id);

-- Rejects lessons placed beyond the timetable's number of periods.
create function private.check_lesson_period()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  period_count integer;
begin
  if tg_table_name = 'lessons' then
    select jsonb_array_length(t.periods) into period_count from public.user_timetables t where t.profile_id = new.profile_id;
  else
    select jsonb_array_length(t.periods) into period_count from public.schedule_templates t where t.id = new.template_id;
  end if;
  if new.period_index >= coalesce(period_count, 0) then
    raise exception 'period_out_of_range' using errcode = '22023';
  end if;
  return new;
end
$$;
create trigger lessons_period_check before insert or update on public.lessons
  for each row execute function private.check_lesson_period();
create trigger template_lessons_period_check before insert or update on public.template_lessons
  for each row execute function private.check_lesson_period();

-- Every new profile starts with an empty timetable on the default bell schedule.
create function private.create_profile_timetable()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  insert into public.user_timetables (profile_id) values (new.id) on conflict do nothing;
  return new;
end
$$;
create trigger profiles_create_timetable after insert on public.profiles
  for each row execute function private.create_profile_timetable();

-- Default subject presets (generic subject names and the project's colour palette).
insert into public.subject_presets (name, short_name, color)
select name, short_name, color
from (values
  ('אנגלית', 'אנגלית', '#999a9d'),
  ('מתמטיקה', 'מתמטיקה', '#1498fd'),
  ('היסטוריה', 'היסטוריה', '#444cc1'),
  ('לשון', 'לשון', '#f4490c'),
  ('תנ"ך', 'תנ"ך', '#04b9d4'),
  ('שפת סימנים', 'שפת סימנים', '#e50066'),
  ('חינוך', 'חינוך', '#ffbe10'),
  ('חינוך גופני', 'חינוך גופני', '#059f8b'),
  ('כימיה', 'כימיה', '#92be43'),
  ('ביוטכנולוגיה', 'ביוטכנולוגיה', '#259e3b')
) as defaults (name, short_name, color)
where not exists (select 1 from public.subject_presets);

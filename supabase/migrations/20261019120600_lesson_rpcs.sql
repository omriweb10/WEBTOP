-- Validated lesson writes shared by the student and admin RPCs.

-- Applies a batch of changes [{day, period_index, preset_id|null}] to one timetable.
-- p_allowed: presets that may be placed (NULL = any non-archived preset, for admins).
-- Every change is validated before anything is written; the batch is atomic.
create function private.apply_lesson_changes(p_profile_id uuid, p_changes jsonb, p_allowed uuid[])
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
      if p_allowed is not null and not (v_preset = any (p_allowed)) then
        raise exception 'preset_not_assigned' using errcode = '42501';
      end if;
      if not exists (select 1 from public.subject_presets sp where sp.id = v_preset
                      and (sp.archived_at is null or v_preset = any (coalesce(p_allowed, '{}')))) then
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

-- Lessons of one timetable as JSON ({day, period_index, preset_id}).
create function private.lessons_json(p_profile_id uuid)
returns jsonb
language sql
stable
security definer
set search_path = ''
as $$
  select coalesce(jsonb_agg(jsonb_build_object('day', l.day, 'period_index', l.period_index, 'preset_id', l.preset_id)
                            order by l.day, l.period_index), '[]'::jsonb)
  from public.lessons l where l.profile_id = p_profile_id
$$;

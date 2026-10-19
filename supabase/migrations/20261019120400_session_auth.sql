-- Authorization helpers and the server-side session lifecycle for student access codes.

-- True when the caller's JWT belongs to an administrator.
create function public.is_admin()
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (select 1 from public.admins a where a.user_id = auth.uid())
$$;

-- The student profile of the caller, but ONLY while the JWT's Supabase session is the
-- single live session of that student's access code and the account is active.
-- A disconnected, revoked or disabled session therefore loses access immediately,
-- even before its short-lived access token expires.
create function public.current_profile_id()
returns uuid
language sql
stable
security definer
set search_path = ''
as $$
  select s.profile_id
  from public.user_sessions s
  join public.profiles p on p.id = s.profile_id
  join public.access_codes c on c.id = s.access_code_id
  where s.status = 'active'
    and s.auth_session_id = nullif(auth.jwt() ->> 'session_id', '')::uuid
    and p.auth_user_id = auth.uid()
    and p.status = 'active'
    and c.status = 'active'
  limit 1
$$;

-- Ends one session and deletes its Supabase Auth session (revoking its refresh tokens).
create function private.end_session(p_session_id uuid, p_reason public.session_end_reason)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_auth_session uuid;
begin
  update public.user_sessions
     set status = 'ended', ended_at = now(), end_reason = p_reason
   where id = p_session_id and status <> 'ended'
  returning auth_session_id into v_auth_session;
  if v_auth_session is not null then
    delete from auth.sessions where id = v_auth_session;
  end if;
end
$$;

-- Ends every live session of a profile (optionally only those of one access code).
create function private.end_live_sessions(p_profile_id uuid, p_code_id uuid, p_reason public.session_end_reason)
returns integer
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_id uuid;
  v_count integer := 0;
begin
  for v_id in
    select id from public.user_sessions
     where status <> 'ended'
       and (p_profile_id is null or profile_id = p_profile_id)
       and (p_code_id is null or access_code_id = p_code_id)
  loop
    perform private.end_session(v_id, p_reason);
    v_count := v_count + 1;
  end loop;
  return v_count;
end
$$;

-- Rate limiting: per IP (10 invalid codes / 15 min) and globally (300 invalid / 10 min,
-- against guessing spread over many IPs). Returns {blocked, retry_after_seconds}.
create function private.check_login_rate(p_ip_hash bytea)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  ip_window constant interval := interval '15 minutes';
  ip_limit constant integer := 10;
  global_window constant interval := interval '10 minutes';
  global_limit constant integer := 300;
  v_count integer;
  v_oldest timestamptz;
begin
  -- Opportunistic cleanup keeps the table small.
  if random() < 0.02 then
    delete from private.login_attempts where attempted_at < now() - interval '1 day';
  end if;

  select count(*), min(attempted_at) into v_count, v_oldest
    from (select attempted_at from private.login_attempts
           where ip_hash = p_ip_hash and outcome = 'invalid' and attempted_at > now() - ip_window
           order by attempted_at desc limit ip_limit) recent;
  if v_count >= ip_limit then
    return jsonb_build_object('blocked', true,
      'retry_after', greatest(1, ceil(extract(epoch from (v_oldest + ip_window - now())))::integer));
  end if;

  select count(*) into v_count from private.login_attempts
   where outcome = 'invalid' and attempted_at > now() - global_window;
  if v_count >= global_limit then
    return jsonb_build_object('blocked', true, 'retry_after', extract(epoch from global_window)::integer);
  end if;
  return jsonb_build_object('blocked', false, 'retry_after', 0);
end
$$;

-- STEP 1 of a student login (called by the student-login Edge Function, service role only).
-- Atomically claims the single session slot of an access code. The code row is locked
-- FOR UPDATE and the partial unique index guarantees that, of any number of concurrent
-- attempts with the same code, exactly one obtains the slot.
create function public.svc_claim_student_session(p_code_hash bytea, p_ip_hash bytea, p_device text)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_rate jsonb;
  v_code record;
  v_profile record;
  v_session_id uuid;
begin
  v_rate := private.check_login_rate(p_ip_hash);
  if (v_rate ->> 'blocked')::boolean then
    insert into private.login_attempts (ip_hash, outcome) values (p_ip_hash, 'rate_limited');
    return jsonb_build_object('status', 'rate_limited', 'retry_after', v_rate -> 'retry_after');
  end if;

  select c.id, c.profile_id, c.status into v_code
    from public.access_codes c where c.code_hash = p_code_hash for update;
  if not found or v_code.status <> 'active' then
    insert into private.login_attempts (ip_hash, outcome) values (p_ip_hash, 'invalid');
    return jsonb_build_object('status', 'invalid_code');
  end if;

  select p.id, p.status, p.auth_user_id into v_profile from public.profiles p where p.id = v_code.profile_id;
  if v_profile.status <> 'active' then
    insert into private.login_attempts (ip_hash, outcome) values (p_ip_hash, 'disabled');
    return jsonb_build_object('status', 'account_disabled');
  end if;

  -- Only logins that never completed (crash between claim and activation) are cleared.
  update public.user_sessions
     set status = 'ended', ended_at = now(), end_reason = 'login_aborted'
   where access_code_id = v_code.id and status = 'pending' and created_at < now() - interval '2 minutes';

  begin
    insert into public.user_sessions (profile_id, access_code_id, device_label)
    values (v_profile.id, v_code.id, left(coalesce(p_device, ''), 120))
    returning id into v_session_id;
  exception when unique_violation then
    insert into private.login_attempts (ip_hash, outcome) values (p_ip_hash, 'in_use');
    return jsonb_build_object('status', 'code_in_use');
  end;

  update public.access_codes set last_used_at = now() where id = v_code.id;
  insert into private.login_attempts (ip_hash, outcome) values (p_ip_hash, 'success');
  return jsonb_build_object('status', 'claimed', 'session_id', v_session_id,
    'profile_id', v_profile.id, 'auth_user_id', v_profile.auth_user_id);
end
$$;

-- STEP 2: binds the claimed slot to the freshly minted Supabase Auth session.
create function public.svc_activate_student_session(p_session_id uuid, p_auth_user_id uuid, p_auth_session_id uuid)
returns boolean
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_profile_id uuid;
begin
  select profile_id into v_profile_id from public.user_sessions where id = p_session_id and status = 'pending' for update;
  if not found then return false; end if;
  update public.profiles set auth_user_id = p_auth_user_id
   where id = v_profile_id and (auth_user_id is null or auth_user_id = p_auth_user_id);
  if not found then return false; end if;
  update public.user_sessions
     set status = 'active', auth_session_id = p_auth_session_id, activated_at = now(), last_seen_at = now()
   where id = p_session_id;
  return true;
end
$$;

-- Releases a claimed slot whose login could not be completed.
create function public.svc_abort_student_session(p_session_id uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  perform private.end_session(p_session_id, 'login_aborted');
end
$$;

-- Replaces a profile's access code with a new HMAC (Edge Function, after verifying the
-- caller is an admin; re-checked here). The old code is revoked and its session ended.
create function public.svc_replace_access_code(
  p_admin_user_id uuid, p_profile_id uuid, p_code_hash bytea, p_hint text, p_strength_bits integer
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_old record;
  v_new record;
begin
  if not exists (select 1 from public.admins where user_id = p_admin_user_id) then
    return jsonb_build_object('status', 'forbidden');
  end if;
  perform 1 from public.profiles where id = p_profile_id for update;
  if not found then return jsonb_build_object('status', 'profile_not_found'); end if;
  if exists (select 1 from public.access_codes where code_hash = p_code_hash) then
    return jsonb_build_object('status', 'code_taken');
  end if;

  for v_old in select id from public.access_codes where profile_id = p_profile_id and status = 'active' loop
    perform private.end_live_sessions(p_profile_id, v_old.id, 'code_revoked');
    update public.access_codes set status = 'revoked', revoked_at = now() where id = v_old.id;
  end loop;

  insert into public.access_codes (profile_id, code_hash, code_hint, strength_bits)
  values (p_profile_id, p_code_hash, p_hint, p_strength_bits)
  returning id, created_at into v_new;
  return jsonb_build_object('status', 'created', 'code_id', v_new.id, 'created_at', v_new.created_at);
end
$$;

-- Service functions are callable only with the service-role key (Edge Functions).
revoke all on function public.svc_claim_student_session(bytea, bytea, text) from public, anon, authenticated;
revoke all on function public.svc_activate_student_session(uuid, uuid, uuid) from public, anon, authenticated;
revoke all on function public.svc_abort_student_session(uuid) from public, anon, authenticated;
revoke all on function public.svc_replace_access_code(uuid, uuid, bytea, text, integer) from public, anon, authenticated;
grant execute on function public.svc_claim_student_session(bytea, bytea, text) to service_role;
grant execute on function public.svc_activate_student_session(uuid, uuid, uuid) to service_role;
grant execute on function public.svc_abort_student_session(uuid) to service_role;
grant execute on function public.svc_replace_access_code(uuid, uuid, bytea, text, integer) to service_role;

revoke all on function public.is_admin() from public, anon;
revoke all on function public.current_profile_id() from public, anon;
grant execute on function public.is_admin() to authenticated, service_role;
grant execute on function public.current_profile_id() to authenticated, service_role;

-- One-time bootstrap, run by the project owner in the SQL editor (never via the API):
--   select private.grant_admin('owner@example.com');
create function private.grant_admin(p_email text)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  insert into public.admins (user_id)
  select id from auth.users where lower(email) = lower(btrim(p_email))
  on conflict do nothing;
  if not exists (select 1 from public.admins a join auth.users u on u.id = a.user_id where lower(u.email) = lower(btrim(p_email))) then
    raise exception 'No Supabase Auth user with email %', p_email;
  end if;
end
$$;

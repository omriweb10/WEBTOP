-- Accounts: administrators, student profiles, hashed access codes, sessions, login attempts.

-- Owners of the admin panel (Supabase Auth users). Granted via SQL, never via the API.
create table public.admins (
  user_id uuid primary key references auth.users (id) on delete cascade,
  created_at timestamptz not null default now()
);

create table public.profiles (
  id uuid primary key default gen_random_uuid(),
  -- Supabase Auth identity minted for this student on first sign-in (never shown to anyone).
  auth_user_id uuid unique references auth.users (id) on delete set null,
  display_name text not null check (char_length(btrim(display_name)) between 1 and 60),
  class_name text not null default '' check (char_length(class_name) <= 30),
  school_name text not null default '' check (char_length(school_name) <= 80),
  bio text not null default '' check (char_length(bio) <= 300),
  -- "<profile id>/<random uuid>.<ext>" inside the private "avatars" bucket.
  avatar_path text check (avatar_path is null or avatar_path ~ '^[0-9a-f-]{36}/[0-9a-f-]{36}\.(webp|jpg|png)$'),
  status public.account_status not null default 'active',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create trigger profiles_updated_at before update on public.profiles
  for each row execute function private.set_updated_at();

-- Personal access codes. Only an HMAC-SHA256 of the normalised code is stored; the
-- secret pepper lives in the Edge Functions' environment, not in the database.
create table public.access_codes (
  id uuid primary key default gen_random_uuid(),
  profile_id uuid not null references public.profiles (id) on delete cascade,
  code_hash bytea not null unique check (octet_length(code_hash) = 32),
  -- Last two characters, so the admin can tell codes apart without revealing them.
  code_hint text not null check (char_length(code_hint) <= 4),
  strength_bits integer not null check (strength_bits between 0 and 1024),
  status public.code_status not null default 'active',
  created_at timestamptz not null default now(),
  revoked_at timestamptz,
  last_used_at timestamptz,
  check ((status = 'revoked') = (revoked_at is not null))
);
create unique index access_codes_one_active_per_profile on public.access_codes (profile_id) where status = 'active';

-- Student sessions. At most ONE non-ended session per access code, enforced atomically
-- by the partial unique index below. Sessions never expire by inactivity; they end only
-- on logout, admin disconnect, code revocation or account disable/delete.
create table public.user_sessions (
  id uuid primary key default gen_random_uuid(),
  profile_id uuid not null references public.profiles (id) on delete cascade,
  access_code_id uuid not null references public.access_codes (id) on delete cascade,
  -- Supabase Auth session id (the JWT "session_id" claim) once the login completes.
  auth_session_id uuid unique,
  status public.session_status not null default 'pending',
  device_label text not null default '' check (char_length(device_label) <= 120),
  created_at timestamptz not null default now(),
  activated_at timestamptz,
  last_seen_at timestamptz,
  ended_at timestamptz,
  end_reason public.session_end_reason,
  check ((status = 'ended') = (ended_at is not null)),
  check (status <> 'active' or auth_session_id is not null)
);
create unique index user_sessions_one_live_per_code on public.user_sessions (access_code_id) where status <> 'ended';
create index user_sessions_live_by_profile on public.user_sessions (profile_id) where status <> 'ended';

-- Login attempts for rate limiting. IPs are stored only as keyed hashes.
create table private.login_attempts (
  id bigint generated always as identity primary key,
  ip_hash bytea not null,
  attempted_at timestamptz not null default now(),
  outcome text not null check (outcome in ('success', 'invalid', 'disabled', 'in_use', 'rate_limited'))
);
create index login_attempts_by_ip on private.login_attempts (ip_hash, attempted_at desc);
create index login_attempts_invalid on private.login_attempts (attempted_at desc) where outcome = 'invalid';

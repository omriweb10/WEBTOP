-- Reproduces the parts of a hosted Supabase database that exist BEFORE our migrations run:
-- the auth schema, extensions, Supabase's default privileges and the storage schema. Runs
-- once per database, after bootstrap-roles.sql has created the cluster-wide roles. Used
-- only by the local test stack and the migration test (never deployed).

-- Supabase Auth (GoTrue) owns the auth schema (roles: bootstrap-roles.sql).
create schema auth authorization supabase_auth_admin;
grant usage on schema auth to anon, authenticated, service_role;

-- Extensions live in their own schema on Supabase.
create schema extensions;
grant usage on schema extensions to anon, authenticated, service_role;
create extension pgcrypto with schema extensions;

-- Supabase's default privileges: API roles get table rights, RLS decides row access.
grant usage on schema public to anon, authenticated, service_role;
alter default privileges in schema public grant all on tables to anon, authenticated, service_role;
alter default privileges in schema public grant all on functions to anon, authenticated, service_role;
alter default privileges in schema public grant all on sequences to anon, authenticated, service_role;

-- Storage schema (subset of supabase/storage's schema that policies and the emulator use).
create schema storage;
grant usage on schema storage to anon, authenticated, service_role;

create table storage.buckets (
  id text primary key,
  name text not null unique,
  owner uuid,
  public boolean not null default false,
  file_size_limit bigint,
  allowed_mime_types text[],
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

create table storage.objects (
  id uuid primary key default gen_random_uuid(),
  bucket_id text references storage.buckets (id),
  name text not null,
  owner uuid,
  created_at timestamptz default now(),
  updated_at timestamptz default now(),
  last_accessed_at timestamptz default now(),
  metadata jsonb,
  path_tokens text[] generated always as (string_to_array(name, '/')) stored,
  unique (bucket_id, name)
);
alter table storage.objects enable row level security;
alter table storage.buckets enable row level security;
create policy buckets_read on storage.buckets for select using (true);
grant all on storage.objects, storage.buckets to anon, authenticated, service_role;

-- Same definition as Supabase: the folder segments of an object path.
create function storage.foldername(name text) returns text[]
language plpgsql immutable as $$
declare
  _parts text[];
begin
  select string_to_array(name, '/') into _parts;
  return _parts[1:array_length(_parts, 1) - 1];
end
$$;

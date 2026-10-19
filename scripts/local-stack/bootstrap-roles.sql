-- Cluster-wide roles of a hosted Supabase project (run once per cluster, before
-- bootstrap.sql). Used only by the local test stack (never deployed).

-- API roles (same names and attributes as Supabase).
create role anon nologin noinherit;
create role authenticated nologin noinherit;
create role service_role nologin noinherit bypassrls;
create role authenticator login noinherit password 'authenticator-local';
grant anon, authenticated, service_role to authenticator;

-- Supabase Auth (GoTrue) connects as this role and owns the auth schema.
create role supabase_auth_admin login superuser password 'auth-admin-local';

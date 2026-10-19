#!/usr/bin/env node
/**
 * Starts a fresh local Supabase-equivalent stack for tests and development:
 * PostgreSQL → Supabase Auth (GoTrue) → our migrations → PostgREST → Edge Functions (Deno)
 * → gateway on http://127.0.0.1:54321. Writes .local-stack/env.json with the URL, keys
 * and a test admin account, then stays in the foreground until interrupted.
 */
import { spawn } from 'node:child_process';
import { createWriteStream, existsSync, mkdirSync, readdirSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { ensureBinaries, GOTRUE_BIN, GOTRUE_DIR, POSTGREST_BIN } from './binaries.mjs';
import {
  ACCESS_CODE_PEPPER,
  ADMIN,
  ANON_KEY,
  API_URL,
  DB_URL,
  ENV_FILE,
  JWT_SECRET,
  PORTS,
  ROOT,
  SERVICE_ROLE_KEY,
  STACK_DIR,
} from './config.mjs';
import { startGateway } from './gateway.mjs';
import { initCluster, psqlCommand, psqlFile, startCluster, stopCluster } from './postgres.mjs';

const LOG_DIR = path.join(STACK_DIR, 'logs');
const children = [];

/** Spawns a long-running service with its output captured to .local-stack/logs/<name>.log. */
function spawnService(name, command, args, env, cwd = ROOT) {
  const log = createWriteStream(path.join(LOG_DIR, `${name}.log`));
  const child = spawn(command, args, { cwd, env: { ...process.env, ...env }, stdio: ['ignore', 'pipe', 'pipe'] });
  child.stdout.pipe(log);
  child.stderr.pipe(log);
  child.on('exit', (code) => {
    if (!shuttingDown) console.error(`[stack] ${name} exited with code ${code} (see ${path.join(LOG_DIR, `${name}.log`)})`);
  });
  children.push(child);
  return child;
}

/** Polls a URL until it answers (any HTTP status) or the timeout elapses. */
async function waitFor(url, name, timeoutMs = 90_000) {
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    try {
      await fetch(url);
      return;
    } catch {
      await new Promise((r) => setTimeout(r, 300));
    }
  }
  throw new Error(`${name} did not start in time (${url})`);
}

/** Creates the test administrator through the Auth admin API and grants admin rights. */
async function createAdmin() {
  const response = await fetch(`${API_URL}/auth/v1/admin/users`, {
    method: 'POST',
    headers: { apikey: SERVICE_ROLE_KEY, Authorization: `Bearer ${SERVICE_ROLE_KEY}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ email: ADMIN.email, password: ADMIN.password, email_confirm: true }),
  });
  if (!response.ok) throw new Error(`creating admin failed: ${response.status} ${await response.text()}`);
  psqlCommand(`select private.grant_admin('${ADMIN.email}')`);
}

let shuttingDown = false;
/** Stops every child process and the database. */
function shutdown(code = 0) {
  shuttingDown = true;
  for (const child of children) child.kill('SIGTERM');
  stopCluster();
  process.exit(code);
}

async function main() {
  mkdirSync(LOG_DIR, { recursive: true });
  ensureBinaries();

  console.info('[stack] PostgreSQL…');
  stopCluster();
  initCluster();
  startCluster();
  psqlFile(path.join(ROOT, 'scripts/local-stack/bootstrap-roles.sql'));
  psqlFile(path.join(ROOT, 'scripts/local-stack/bootstrap.sql'));

  console.info('[stack] Supabase Auth…');
  spawnService('gotrue', GOTRUE_BIN, [], {
    GOTRUE_DB_DRIVER: 'postgres',
    DATABASE_URL: `postgres://supabase_auth_admin:auth-admin-local@127.0.0.1:${PORTS.postgres}/postgres?search_path=auth`,
    GOTRUE_DB_NAMESPACE: 'auth',
    GOTRUE_DB_MIGRATIONS_PATH: path.join(GOTRUE_DIR, 'migrations'),
    GOTRUE_API_HOST: '127.0.0.1',
    PORT: String(PORTS.gotrue),
    API_EXTERNAL_URL: `${API_URL}/auth/v1`,
    GOTRUE_SITE_URL: 'http://localhost:4173',
    GOTRUE_JWT_SECRET: JWT_SECRET,
    GOTRUE_JWT_EXP: '3600',
    GOTRUE_JWT_AUD: 'authenticated',
    // Hosted Supabase sets this; it is the "role" claim (and the Postgres role) of users' JWTs.
    GOTRUE_JWT_DEFAULT_GROUP_NAME: 'authenticated',
    GOTRUE_JWT_ADMIN_ROLES: 'service_role',
    GOTRUE_DISABLE_SIGNUP: 'true',
    GOTRUE_EXTERNAL_EMAIL_ENABLED: 'true',
    GOTRUE_MAILER_AUTOCONFIRM: 'true',
    GOTRUE_SECURITY_REFRESH_TOKEN_ROTATION_ENABLED: 'true',
    GOTRUE_SECURITY_REFRESH_TOKEN_REUSE_INTERVAL: '10',
    GOTRUE_RATE_LIMIT_VERIFY: '100000',
    GOTRUE_RATE_LIMIT_TOKEN_REFRESH: '100000',
    GOTRUE_RATE_LIMIT_OTP: '100000',
    GOTRUE_RATE_LIMIT_EMAIL_SENT: '100000',
    GOTRUE_LOG_LEVEL: 'warn',
  }, GOTRUE_DIR);
  await waitFor(`http://127.0.0.1:${PORTS.gotrue}/health`, 'Supabase Auth');

  console.info('[stack] Migrations…');
  const migrationsDir = path.join(ROOT, 'supabase/migrations');
  for (const file of readdirSync(migrationsDir).filter((f) => f.endsWith('.sql')).sort()) {
    psqlFile(path.join(migrationsDir, file));
  }

  console.info('[stack] PostgREST…');
  spawnService('postgrest', POSTGREST_BIN, [], {
    PGRST_DB_URI: `postgres://authenticator:authenticator-local@127.0.0.1:${PORTS.postgres}/postgres`,
    PGRST_DB_SCHEMAS: 'public',
    PGRST_DB_ANON_ROLE: 'anon',
    PGRST_JWT_SECRET: JWT_SECRET,
    PGRST_SERVER_HOST: '127.0.0.1',
    PGRST_SERVER_PORT: String(PORTS.postgrest),
    PGRST_LOG_LEVEL: 'warn',
  });
  await waitFor(`http://127.0.0.1:${PORTS.postgrest}/`, 'PostgREST');

  console.info('[stack] Edge Functions…');
  const deno = path.join(ROOT, 'node_modules/.bin/deno');
  const certFile = '/root/.ccr/ca-bundle.crt';
  spawnService('functions', deno, [
    'run', '--allow-net', '--allow-env', '--allow-read',
    '--config', 'scripts/local-stack/deno.json', 'scripts/local-stack/functions-server.ts',
  ], {
    PORT: String(PORTS.functions),
    SUPABASE_URL: API_URL,
    SUPABASE_ANON_KEY: ANON_KEY,
    SUPABASE_SERVICE_ROLE_KEY: SERVICE_ROLE_KEY,
    ACCESS_CODE_PEPPER,
    DENO_DIR: path.join(STACK_DIR, 'deno-cache'),
    DENO_NO_UPDATE_CHECK: '1',
    ...(existsSync(certFile) ? { DENO_CERT: certFile } : {}),
  });

  await startGateway();
  await waitFor(`http://127.0.0.1:${PORTS.functions}/`, 'Edge Functions', 180_000);
  await createAdmin();

  const env = { apiUrl: API_URL, anonKey: ANON_KEY, serviceRoleKey: SERVICE_ROLE_KEY, dbUrl: DB_URL, admin: ADMIN, pepper: ACCESS_CODE_PEPPER };
  writeFileSync(ENV_FILE, JSON.stringify(env, null, 2));
  console.info(`[stack] ready at ${API_URL} (env: ${ENV_FILE})`);
}

process.on('SIGINT', () => shutdown(0));
process.on('SIGTERM', () => shutdown(0));
main().catch((error) => {
  console.error('[stack] failed:', error);
  shutdown(1);
});

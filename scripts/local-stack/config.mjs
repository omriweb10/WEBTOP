/**
 * Configuration of the local Supabase-equivalent test stack. The secrets are generated
 * freshly for every stack run (the database is recreated each time) and are only written
 * to the git-ignored .local-stack/env.json, so nothing secret lives in the repository.
 */
import { createHmac, randomBytes } from 'node:crypto';
import path from 'node:path';

export const ROOT = path.resolve(new URL('../..', import.meta.url).pathname);
export const STACK_DIR = path.join(ROOT, '.local-stack');
export const BIN_DIR = path.join(STACK_DIR, 'bin');
export const PG_DATA = path.join(STACK_DIR, 'pgdata');
export const ENV_FILE = path.join(STACK_DIR, 'env.json');

export const VERSIONS = { postgrest: 'v12.2.3', auth: 'v2.177.0' };

export const PORTS = { gateway: 54321, functions: 54322, postgres: 54329, gotrue: 54325, postgrest: 54326 };

export const JWT_SECRET = randomBytes(32).toString('base64url');
export const ACCESS_CODE_PEPPER = randomBytes(32).toString('base64url');
export const ADMIN = { email: 'admin@webtop.test', password: `Aa1-${randomBytes(18).toString('base64url')}` };

/** base64url without padding. */
function b64url(input) {
  return Buffer.from(input).toString('base64').replace(/=+$/, '').replace(/\+/g, '-').replace(/\//g, '_');
}

/** Signs an HS256 JWT (used for the anon / service_role API keys). */
export function signJwt(payload, secret = JWT_SECRET) {
  const header = b64url(JSON.stringify({ alg: 'HS256', typ: 'JWT' }));
  const body = b64url(JSON.stringify(payload));
  const signature = createHmac('sha256', secret).update(`${header}.${body}`).digest('base64url');
  return `${header}.${body}.${signature}`;
}

const TEN_YEARS = 10 * 365 * 24 * 3600;
const issuedAt = 1_700_000_000;
export const ANON_KEY = signJwt({ role: 'anon', iss: 'supabase-local', iat: issuedAt, exp: issuedAt + TEN_YEARS });
export const SERVICE_ROLE_KEY = signJwt({ role: 'service_role', iss: 'supabase-local', iat: issuedAt, exp: issuedAt + TEN_YEARS });

export const DB_URL = `postgres://postgres@127.0.0.1:${PORTS.postgres}/postgres`;
export const API_URL = `http://127.0.0.1:${PORTS.gateway}`;

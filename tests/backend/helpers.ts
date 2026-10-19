/**
 * Helpers for backend tests. They talk to the local Supabase-equivalent stack
 * (scripts/local-stack/start.mjs) exactly like the app does: through the gateway with
 * the anon key, real Auth sessions, PostgREST and the Edge Functions.
 */
import { createClient, type SupabaseClient } from '@supabase/supabase-js';
import { existsSync, readFileSync } from 'node:fs';
import path from 'node:path';
import pg from 'pg';

export interface StackEnv {
  apiUrl: string;
  anonKey: string;
  serviceRoleKey: string;
  dbUrl: string;
  admin: { email: string; password: string };
}

const ENV_FILE = path.resolve('.local-stack/env.json');
export const stackAvailable = existsSync(ENV_FILE);
export const env: StackEnv = stackAvailable ? JSON.parse(readFileSync(ENV_FILE, 'utf8')) : ({} as StackEnv);

const NO_PERSIST = { auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false } };

/** A fresh, unauthenticated client (anon key). */
export function anonClient(): SupabaseClient {
  return createClient(env.apiUrl, env.anonKey, NO_PERSIST);
}

let adminPromise: Promise<SupabaseClient> | null = null;
/** A client signed in as the test administrator (cached per test file). */
export function adminClient(): Promise<SupabaseClient> {
  adminPromise ??= (async () => {
    const client = anonClient();
    const { error } = await client.auth.signInWithPassword(env.admin);
    if (error) throw error;
    return client;
  })();
  return adminPromise;
}

/** Raw SQL as the database owner, for arranging and inspecting state. */
export async function sql<T extends pg.QueryResultRow = pg.QueryResultRow>(text: string, params: unknown[] = []): Promise<T[]> {
  const client = new pg.Client({ connectionString: env.dbUrl });
  await client.connect();
  try {
    return (await client.query<T>(text, params)).rows;
  } finally {
    await client.end();
  }
}

let ipCounter = Math.floor(Math.random() * 200);
/** A unique fake client IP so rate-limit state never leaks between tests. */
export function freshIp(): string {
  ipCounter += 1;
  return `10.${Math.floor(Math.random() * 250)}.${Math.floor(ipCounter / 250) % 250}.${ipCounter % 250}`;
}

/** Calls an Edge Function through the gateway. */
export async function callFunction(
  name: string,
  body: unknown,
  options: { token?: string; ip?: string } = {},
): Promise<{ status: number; body: Record<string, unknown> }> {
  const response = await fetch(`${env.apiUrl}/functions/v1/${name}`, {
    method: 'POST',
    headers: {
      apikey: env.anonKey,
      Authorization: `Bearer ${options.token ?? env.anonKey}`,
      'Content-Type': 'application/json',
      'x-forwarded-for': options.ip ?? freshIp(),
    },
    body: JSON.stringify(body),
  });
  return { status: response.status, body: (await response.json()) as Record<string, unknown> };
}

/** Creates a student profile and a generated access code as the admin. */
export async function createStudent(fields: Record<string, unknown> = {}): Promise<{ profileId: string; code: string }> {
  const admin = await adminClient();
  const { data, error } = await admin
    .from('profiles')
    .insert({ display_name: `תלמיד ${Math.random().toString(36).slice(2, 7)}`, class_name: "י' 1", ...fields })
    .select('id')
    .single();
  if (error) throw error;
  const token = (await admin.auth.getSession()).data.session?.access_token;
  const result = await callFunction('admin-access-code', { profileId: data.id, mode: 'generate' }, { token });
  if (result.status !== 200) throw new Error(`code creation failed: ${JSON.stringify(result.body)}`);
  return { profileId: data.id, code: String(result.body.code) };
}

/** Logs a student in with their code and returns a client holding that session. */
export async function loginStudent(code: string, ip = freshIp()): Promise<{ status: number; client: SupabaseClient; body: Record<string, unknown> }> {
  const result = await callFunction('student-login', { code, device: 'test device' }, { ip });
  const client = anonClient();
  if (result.status === 200) {
    const { error } = await client.auth.setSession(result.body.session as { access_token: string; refresh_token: string });
    if (error) throw error;
  }
  return { ...result, client };
}

/** Library preset ids (the seeded defaults, never visible to students), by name. */
export async function presetIds(): Promise<string[]> {
  const rows = await sql<{ id: string }>('select id from public.subject_presets where profile_id is null order by name');
  return rows.map((r) => r.id);
}

/** Creates a preset in one student's own list (as the admin); returns its id. */
export async function createUserPreset(
  profileId: string,
  fields: { name: string; teacher?: string; room?: string; color?: string },
): Promise<string> {
  const admin = await adminClient();
  const { data, error } = await admin
    .from('subject_presets')
    .insert({ profile_id: profileId, color: '#1498fd', ...fields })
    .select('id')
    .single();
  if (error) throw error;
  return data.id as string;
}

/** A per-run unique suffix so fixed-shape custom codes never collide with earlier runs. */
export function uniqueDigits(length: number): string {
  return Array.from({ length }, () => Math.floor(Math.random() * 10)).join('');
}

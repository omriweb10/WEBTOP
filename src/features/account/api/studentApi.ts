/**
 * Student-side backend calls. Every call is authorised on the server from the live
 * session; nothing here trusts identifiers kept on the device.
 */
import type { SupabaseClient } from '@supabase/supabase-js';
import { getStudentClient, requireBackend } from '../../../services/supabase/clients';
import { BundleSchema, ServerLessonListSchema, type Bundle, type LessonChange, type ServerLesson } from '../domain/bundle';
import { loginFailureFromResponse, type LoginFailure } from '../domain/loginMessages';

/** Tokens returned by the student-login function. */
interface IssuedSession {
  access_token: string;
  refresh_token: string;
}

export type LoginResponse = { ok: true; session: IssuedSession } | { ok: false; failure: LoginFailure };

/** Result of a call that either succeeds or fails with the raw backend error. */
export type ApiResult<T> = { ok: true; data: T } | { ok: false; error: unknown };

const AVATAR_URL_TTL_SECONDS = 12 * 3600;

/** Exchanges an access code for a new session (the server enforces one device per code). */
export async function requestLogin(code: string, device: string): Promise<LoginResponse> {
  const { url, anonKey } = requireBackend();
  let response: Response;
  try {
    response = await fetch(`${url}/functions/v1/student-login`, {
      method: 'POST',
      headers: { apikey: anonKey, Authorization: `Bearer ${anonKey}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ code, device }),
    });
  } catch {
    return { ok: false, failure: { kind: 'offline' } };
  }
  const body = (await response.json().catch(() => ({}))) as Record<string, unknown>;
  if (!response.ok) return { ok: false, failure: loginFailureFromResponse(response.status, body) };
  const session = body.session as Partial<IssuedSession> | undefined;
  if (!session?.access_token || !session.refresh_token) return { ok: false, failure: { kind: 'unavailable' } };
  return { ok: true, session: { access_token: session.access_token, refresh_token: session.refresh_token } };
}

/**
 * Ends a session using only its access token. Used when a login succeeded on the server
 * but the device could not store the session, so the code is not left locked.
 */
export async function endSessionWithToken(accessToken: string): Promise<void> {
  const { url, anonKey } = requireBackend();
  await fetch(`${url}/rest/v1/rpc/end_my_session`, {
    method: 'POST',
    headers: { apikey: anonKey, Authorization: `Bearer ${accessToken}`, 'Content-Type': 'application/json' },
    body: '{}',
  }).catch(() => undefined);
}

/** Loads and validates the student's full snapshot. */
export async function fetchBundle(client: SupabaseClient = getStudentClient()): Promise<ApiResult<Bundle>> {
  const { data, error } = await client.rpc('get_my_bundle');
  if (error) return { ok: false, error };
  const parsed = BundleSchema.safeParse(data);
  if (!parsed.success) return { ok: false, error: new Error(`Unexpected bundle: ${parsed.error.message.slice(0, 200)}`) };
  return { ok: true, data: parsed.data };
}

/** Saves a batch of cell changes; returns the timetable's lessons as stored. */
export async function saveMyLessons(changes: readonly LessonChange[]): Promise<ApiResult<ServerLesson[]>> {
  const { data, error } = await getStudentClient().rpc('save_my_lessons', { p_changes: changes });
  if (error) return { ok: false, error };
  const parsed = ServerLessonListSchema.safeParse(data);
  return parsed.success ? { ok: true, data: parsed.data } : { ok: false, error: new Error('Unexpected lessons payload') };
}

/** Records activity for the admin's "connected" indicator; false = the session has ended. */
export async function touchSession(): Promise<ApiResult<boolean>> {
  const { data, error } = await getStudentClient().rpc('touch_my_session');
  return error ? { ok: false, error } : { ok: true, data: data === true };
}

/** Ends this device's session on the server (explicit logout). */
export async function endMySession(): Promise<ApiResult<boolean>> {
  const { data, error } = await getStudentClient().rpc('end_my_session');
  return error ? { ok: false, error } : { ok: true, data: data === true };
}

/** Signed URL for the student's own profile picture (the bucket is private). */
export async function signedAvatarUrl(path: string): Promise<string | null> {
  const { data, error } = await getStudentClient().storage.from('avatars').createSignedUrl(path, AVATAR_URL_TTL_SECONDS);
  return error ? null : data.signedUrl;
}

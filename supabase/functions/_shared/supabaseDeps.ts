/**
 * Real implementations of the handlers' dependencies, backed by Supabase
 * (service-role client for RPCs and Auth admin, anon client to verify the one-time token).
 * The service-role key exists only in the Edge Function environment.
 */
import { createClient, type SupabaseClient } from '@supabase/supabase-js';
import type { AdminCodeDeps, ReplaceResult } from '../admin-access-code/handler.ts';
import type { ClaimResult, MintedSession, StudentLoginDeps } from '../student-login/handler.ts';
import { decodeJwtPayload } from './http.ts';

/** Reads a required environment variable. */
export function requireEnv(name: string): string {
  const value = Deno.env.get(name);
  if (!value) throw new Error(`Missing environment variable ${name}`);
  return value;
}

/** Client options for server-side use: no persisted or auto-refreshed sessions. */
const SERVER_AUTH = { auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false } };

/** Service-role client (bypasses RLS) — server only. */
export function serviceClient(): SupabaseClient {
  return createClient(requireEnv('SUPABASE_URL'), requireEnv('SUPABASE_SERVICE_ROLE_KEY'), SERVER_AUTH);
}

/** Anon client used to exchange the one-time token for a session. */
function anonClient(): SupabaseClient {
  return createClient(requireEnv('SUPABASE_URL'), requireEnv('SUPABASE_ANON_KEY'), SERVER_AUTH);
}

const DEFAULT_STUDENT_EMAIL_DOMAIN = 'students.webtop.invalid';

/**
 * Synthetic, undeliverable e-mail identifying a student's Auth user (RFC 2606 ".invalid").
 * STUDENT_EMAIL_DOMAIN can override the domain for projects whose Auth settings reject it;
 * existing students keep the address they were created with.
 */
export function studentEmail(profileId: string): string {
  const configured = Deno.env.get('STUDENT_EMAIL_DOMAIN')?.trim().toLowerCase();
  const domain = configured && /^[a-z0-9.-]+\.[a-z]{2,}$/.test(configured) ? configured : DEFAULT_STUDENT_EMAIL_DOMAIN;
  return `student-${profileId}@${domain}`;
}

/** Calls an RPC and throws on error. */
async function rpc<T>(client: SupabaseClient, fn: string, args: Record<string, unknown>): Promise<T> {
  const { data, error } = await client.rpc(fn, args);
  if (error) throw new Error(`${fn}: ${error.message}`);
  return data as T;
}

/** Creates the student's Auth user if needed and returns its id. */
async function ensureAuthUser(service: SupabaseClient, profileId: string, existing: string | null): Promise<string> {
  if (existing) return existing;
  const { data, error } = await service.auth.admin.createUser({
    email: studentEmail(profileId),
    email_confirm: true,
    app_metadata: { kind: 'student', profile_id: profileId },
  });
  if (data.user) return data.user.id;
  // A previous attempt may have created it before failing: recover the id via a link.
  const { data: link, error: linkError } = await service.auth.admin.generateLink({ type: 'magiclink', email: studentEmail(profileId) });
  if (link.user) return link.user.id;
  throw new Error(`createUser failed: ${error?.message ?? linkError?.message}`);
}

/** Mints a Supabase Auth session for the student without sending any e-mail. */
async function mintStudentSession(profileId: string, existingAuthUserId: string | null): Promise<MintedSession> {
  const service = serviceClient();
  const authUserId = await ensureAuthUser(service, profileId, existingAuthUserId);
  const { data: user, error: userError } = await service.auth.admin.getUserById(authUserId);
  if (userError || !user.user?.email) throw new Error(`getUserById failed: ${userError?.message}`);

  const { data: link, error: linkError } = await service.auth.admin.generateLink({ type: 'magiclink', email: user.user.email });
  const tokenHash = link.properties?.hashed_token;
  if (linkError || !tokenHash) throw new Error(`generateLink failed: ${linkError?.message}`);

  const { data: verified, error: verifyError } = await anonClient().auth.verifyOtp({ type: 'email', token_hash: tokenHash });
  const session = verified.session;
  if (verifyError || !session) throw new Error(`verifyOtp failed: ${verifyError?.message}`);
  const authSessionId = decodeJwtPayload(session.access_token)?.session_id;
  if (typeof authSessionId !== 'string') throw new Error('access token has no session_id');

  return {
    authUserId,
    authSessionId,
    session: {
      access_token: session.access_token,
      refresh_token: session.refresh_token,
      expires_in: session.expires_in,
      expires_at: session.expires_at,
      token_type: session.token_type,
    },
  };
}

/** Dependencies of the student-login handler. */
export function studentLoginDeps(): StudentLoginDeps {
  const service = serviceClient();
  return {
    pepper: requireEnv('ACCESS_CODE_PEPPER'),
    claim: (codeHash, ipHash, device) =>
      rpc<ClaimResult>(service, 'svc_claim_student_session', { p_code_hash: codeHash, p_ip_hash: ipHash, p_device: device }),
    activate: (sessionId, authUserId, authSessionId) =>
      rpc<boolean>(service, 'svc_activate_student_session', {
        p_session_id: sessionId,
        p_auth_user_id: authUserId,
        p_auth_session_id: authSessionId,
      }),
    abort: async (sessionId) => {
      await rpc(service, 'svc_abort_student_session', { p_session_id: sessionId });
    },
    mint: mintStudentSession,
  };
}

/** Dependencies of the admin-access-code handler. */
export function adminAccessCodeDeps(): AdminCodeDeps {
  const service = serviceClient();
  return {
    pepper: requireEnv('ACCESS_CODE_PEPPER'),
    getAdminUserId: async (jwt) => {
      const { data, error } = await service.auth.getUser(jwt);
      if (error || !data.user) return null;
      const { data: admin } = await service.from('admins').select('user_id').eq('user_id', data.user.id).maybeSingle();
      return admin ? data.user.id : null;
    },
    replace: (adminUserId, profileId, codeHash, hint, bits) =>
      rpc<ReplaceResult>(service, 'svc_replace_access_code', {
        p_admin_user_id: adminUserId,
        p_profile_id: profileId,
        p_code_hash: codeHash,
        p_hint: hint,
        p_strength_bits: bits,
      }),
  };
}

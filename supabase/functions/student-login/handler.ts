/**
 * Student access-code login.
 *  1. HMAC the normalised code (and the caller's IP) with the secret pepper.
 *  2. Atomically claim the code's single session slot in Postgres (rate limiting,
 *     revoked/disabled checks and the one-session rule all happen there, in one transaction).
 *  3. Mint a real Supabase Auth session for the student (short-lived access token +
 *     rotating refresh token) and bind it to the claimed slot.
 *  Any failure after the claim releases the slot, so a crash never locks a code.
 */
import { hashAccessCode, hmacSha256, normalizeAccessCode, toByteaHex } from '../_shared/accessCode.ts';
import { clientIp, corsHeaders, errorResponse, json, readJsonObject } from '../_shared/http.ts';

export type ClaimStatus = 'claimed' | 'invalid_code' | 'account_disabled' | 'code_in_use' | 'rate_limited';

export interface ClaimResult {
  status: ClaimStatus;
  session_id?: string;
  profile_id?: string;
  auth_user_id?: string | null;
  retry_after?: number;
}

export interface AuthSessionTokens {
  access_token: string;
  refresh_token: string;
  expires_in: number;
  expires_at?: number;
  token_type: string;
}

export interface MintedSession {
  authUserId: string;
  authSessionId: string;
  session: AuthSessionTokens;
}

export interface StudentLoginDeps {
  pepper: string;
  claim: (codeHash: string, ipHash: string, device: string) => Promise<ClaimResult>;
  activate: (sessionId: string, authUserId: string, authSessionId: string) => Promise<boolean>;
  abort: (sessionId: string) => Promise<void>;
  mint: (profileId: string, existingAuthUserId: string | null) => Promise<MintedSession>;
}

/** Keeps a short, printable device description (shown to the admin). */
export function sanitizeDeviceLabel(value: unknown): string {
  if (typeof value !== 'string') return '';
  return value.replace(/[\p{Cc}<>]/gu, '').trim().slice(0, 120);
}

/** Maps a non-successful claim to its HTTP response. */
function claimFailure(result: ClaimResult): Response {
  switch (result.status) {
    case 'rate_limited': {
      const retryAfter = Math.max(1, Math.round(result.retry_after ?? 60));
      return errorResponse(429, 'rate_limited', { retry_after: retryAfter });
    }
    case 'account_disabled':
      return errorResponse(403, 'account_disabled');
    case 'code_in_use':
      return errorResponse(409, 'code_in_use');
    default:
      return errorResponse(401, 'invalid_code');
  }
}

/** Builds the request handler. */
export function createStudentLoginHandler(deps: StudentLoginDeps): (req: Request) => Promise<Response> {
  return async (req) => {
    if (req.method === 'OPTIONS') return new Response(null, { status: 204, headers: corsHeaders });
    if (req.method !== 'POST') return errorResponse(405, 'method_not_allowed');

    const body = await readJsonObject(req);
    if (!body || typeof body.code !== 'string') return errorResponse(400, 'invalid_request');

    const code = normalizeAccessCode(body.code.slice(0, 128));
    const [codeHash, ipHash] = await Promise.all([
      hashAccessCode(code, deps.pepper),
      hmacSha256(deps.pepper, `ip:v1:${clientIp(req)}`),
    ]);

    let claim: ClaimResult;
    try {
      claim = await deps.claim(toByteaHex(codeHash), toByteaHex(ipHash), sanitizeDeviceLabel(body.device));
    } catch (error) {
      console.error('[student-login] claim failed', error);
      return errorResponse(503, 'login_unavailable');
    }
    if (claim.status !== 'claimed' || !claim.session_id || !claim.profile_id) {
      const response = claimFailure(claim);
      if (claim.status === 'rate_limited') response.headers.set('Retry-After', String(claim.retry_after ?? 60));
      return response;
    }

    try {
      const minted = await deps.mint(claim.profile_id, claim.auth_user_id ?? null);
      const activated = await deps.activate(claim.session_id, minted.authUserId, minted.authSessionId);
      if (!activated) {
        await deps.abort(claim.session_id);
        return errorResponse(409, 'login_interrupted');
      }
      return json(200, { session: minted.session, profile_id: claim.profile_id });
    } catch (error) {
      console.error('[student-login] session minting failed', error);
      await deps.abort(claim.session_id).catch(() => undefined);
      return errorResponse(503, 'login_unavailable');
    }
  };
}

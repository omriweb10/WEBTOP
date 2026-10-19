/**
 * Admin-only: creates or replaces a student's personal access code.
 * The plaintext code is returned exactly once in this response and never stored;
 * only HMAC-SHA256(pepper, code) reaches the database.
 */
import {
  codeHint,
  estimateCodeStrength,
  formatAccessCode,
  generateAccessCode,
  hashAccessCode,
  MAX_CODE_LENGTH,
  normalizeAccessCode,
  toByteaHex,
} from '../_shared/accessCode.ts';
import { bearerToken, corsHeaders, errorResponse, json, readJsonObject } from '../_shared/http.ts';

export interface ReplaceResult {
  status: 'created' | 'code_taken' | 'profile_not_found' | 'forbidden';
  code_id?: string;
  created_at?: string;
}

export interface AdminCodeDeps {
  pepper: string;
  /** Verifies the JWT with Supabase Auth and returns the user id if it is an admin. */
  getAdminUserId: (jwt: string) => Promise<string | null>;
  replace: (adminUserId: string, profileId: string, codeHash: string, hint: string, bits: number) => Promise<ReplaceResult>;
  random?: (bytes: Uint8Array) => Uint8Array;
}

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/** Decides the code to store: a generated one, or a validated custom one. */
function chooseCode(body: Record<string, unknown>, random?: AdminCodeDeps['random']):
  | { ok: true; code: string }
  | { ok: false; response: Response } {
  if (body.mode === 'generate') return { ok: true, code: generateAccessCode(random) };
  if (body.mode !== 'custom' || typeof body.code !== 'string') {
    return { ok: false, response: errorResponse(400, 'invalid_request') };
  }
  const code = normalizeAccessCode(body.code);
  if (code.length > MAX_CODE_LENGTH) return { ok: false, response: errorResponse(400, 'code_too_long') };
  const strength = estimateCodeStrength(code);
  if (strength.level === 'too_short') return { ok: false, response: errorResponse(400, 'code_too_short') };
  if (strength.level === 'weak' && body.allowWeak !== true) {
    return { ok: false, response: errorResponse(422, 'code_too_weak', { warnings: strength.warnings, bits: strength.bits }) };
  }
  return { ok: true, code };
}

/** Builds the request handler. */
export function createAdminAccessCodeHandler(deps: AdminCodeDeps): (req: Request) => Promise<Response> {
  return async (req) => {
    if (req.method === 'OPTIONS') return new Response(null, { status: 204, headers: corsHeaders });
    if (req.method !== 'POST') return errorResponse(405, 'method_not_allowed');

    const jwt = bearerToken(req);
    const adminUserId = jwt ? await deps.getAdminUserId(jwt).catch(() => null) : null;
    if (!adminUserId) return errorResponse(403, 'admin_required');

    const body = await readJsonObject(req);
    if (!body || typeof body.profileId !== 'string' || !UUID.test(body.profileId)) {
      return errorResponse(400, 'invalid_request');
    }
    const chosen = chooseCode(body, deps.random);
    if (!chosen.ok) return chosen.response;

    const hash = await hashAccessCode(chosen.code, deps.pepper);
    const strength = estimateCodeStrength(chosen.code);
    const result = await deps.replace(adminUserId, body.profileId, toByteaHex(hash), codeHint(chosen.code), strength.bits);
    switch (result.status) {
      case 'created':
        return json(200, {
          code: formatAccessCode(chosen.code),
          hint: codeHint(chosen.code),
          strength_bits: strength.bits,
          code_id: result.code_id,
          created_at: result.created_at,
        });
      case 'code_taken':
        return errorResponse(409, 'code_taken');
      case 'profile_not_found':
        return errorResponse(404, 'profile_not_found');
      default:
        return errorResponse(403, 'admin_required');
    }
  };
}

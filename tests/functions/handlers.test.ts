import { describe, expect, it, vi } from 'vitest';
import { hashAccessCode, toByteaHex } from '../../supabase/functions/_shared/accessCode.ts';
import { createAdminAccessCodeHandler, type AdminCodeDeps } from '../../supabase/functions/admin-access-code/handler.ts';
import { createStudentLoginHandler, type StudentLoginDeps } from '../../supabase/functions/student-login/handler.ts';

const PEPPER = 'unit-test-pepper';

/** POST request helper. */
function post(body: unknown, headers: Record<string, string> = {}): Request {
  return new Request('http://fn.local/', { method: 'POST', body: JSON.stringify(body), headers: { 'Content-Type': 'application/json', ...headers } });
}

/** Student-login deps with spies and a successful default path. */
function studentDeps(overrides: Partial<StudentLoginDeps> = {}): StudentLoginDeps {
  return {
    pepper: PEPPER,
    claim: vi.fn(async () => ({ status: 'claimed' as const, session_id: 's1', profile_id: 'p1', auth_user_id: null })),
    activate: vi.fn(async () => true),
    abort: vi.fn(async () => undefined),
    mint: vi.fn(async () => ({
      authUserId: 'u1',
      authSessionId: 'as1',
      session: { access_token: 'a', refresh_token: 'r', expires_in: 3600, token_type: 'bearer' },
    })),
    ...overrides,
  };
}

describe('student-login handler', () => {
  it('answers CORS preflight and rejects other methods and bad bodies', async () => {
    const handler = createStudentLoginHandler(studentDeps());
    expect((await handler(new Request('http://fn.local/', { method: 'OPTIONS' }))).status).toBe(204);
    expect((await handler(new Request('http://fn.local/', { method: 'GET' }))).status).toBe(405);
    expect((await handler(post({ nope: 1 }))).status).toBe(400);
  });

  it('hashes the normalised code and the client IP before claiming', async () => {
    const deps = studentDeps();
    const handler = createStudentLoginHandler(deps);
    await handler(post({ code: 'abcd efgh-jklm', device: 'iPhone <b>' }, { 'x-forwarded-for': '1.2.3.4, 10.0.0.1' }));
    const [codeHash, ipHash, device] = vi.mocked(deps.claim).mock.calls[0] ?? [];
    expect(codeHash).toBe(toByteaHex(await hashAccessCode('ABCDEFGHJKLM', PEPPER)));
    expect(ipHash).toMatch(/^\\x[0-9a-f]{64}$/);
    expect(device).toBe('iPhone b');
  });

  it('mints, activates and returns the session on success', async () => {
    const deps = studentDeps();
    const res = await createStudentLoginHandler(deps)(post({ code: 'X' }));
    expect(res.status).toBe(200);
    expect(await res.json()).toMatchObject({ profile_id: 'p1', session: { access_token: 'a', refresh_token: 'r' } });
    expect(deps.activate).toHaveBeenCalledWith('s1', 'u1', 'as1');
    expect(deps.abort).not.toHaveBeenCalled();
  });

  it.each([
    ['invalid_code', 401],
    ['account_disabled', 403],
    ['code_in_use', 409],
    ['rate_limited', 429],
  ] as const)('maps %s to HTTP %i', async (status, http) => {
    const res = await createStudentLoginHandler(studentDeps({ claim: async () => ({ status, retry_after: 42 }) }))(post({ code: 'X' }));
    expect(res.status).toBe(http);
    expect((await res.json()).error).toBe(status);
    if (status === 'rate_limited') expect(res.headers.get('Retry-After')).toBe('42');
  });

  it('releases the claimed slot when minting fails or activation is refused', async () => {
    const failing = studentDeps({ mint: async () => Promise.reject(new Error('auth down')) });
    expect((await createStudentLoginHandler(failing)(post({ code: 'X' }))).status).toBe(503);
    expect(failing.abort).toHaveBeenCalledWith('s1');

    const refused = studentDeps({ activate: async () => false });
    expect((await createStudentLoginHandler(refused)(post({ code: 'X' }))).status).toBe(409);
    expect(refused.abort).toHaveBeenCalledWith('s1');
  });
});

/** Admin-code deps with spies. */
function adminDeps(overrides: Partial<AdminCodeDeps> = {}): AdminCodeDeps {
  return {
    pepper: PEPPER,
    getAdminUserId: vi.fn(async (jwt: string) => (jwt === 'admin-jwt' ? 'admin-1' : null)),
    replace: vi.fn(async () => ({ status: 'created' as const, code_id: 'c1', created_at: '2026-10-19' })),
    ...overrides,
  };
}

const PROFILE = '0b0f5c2e-7f1a-4f6e-9d55-0c1d2e3f4a5b';

describe('admin-access-code handler', () => {
  it('requires an admin token', async () => {
    const handler = createAdminAccessCodeHandler(adminDeps());
    expect((await handler(post({ profileId: PROFILE, mode: 'generate' }))).status).toBe(403);
    expect((await handler(post({ profileId: PROFILE, mode: 'generate' }, { Authorization: 'Bearer student-jwt' }))).status).toBe(403);
  });

  it('generates a code, stores only its hash and returns it once', async () => {
    const deps = adminDeps();
    const res = await createAdminAccessCodeHandler(deps)(post({ profileId: PROFILE, mode: 'generate' }, { Authorization: 'Bearer admin-jwt' }));
    const body = await res.json();
    expect(res.status).toBe(200);
    expect(body.code).toMatch(/^[2-9A-Z]{4}-[2-9A-Z]{4}-[2-9A-Z]{4}$/);
    const [adminId, profileId, hash, hint] = vi.mocked(deps.replace).mock.calls[0] ?? [];
    expect([adminId, profileId]).toEqual(['admin-1', PROFILE]);
    expect(hash).toBe(toByteaHex(await hashAccessCode(body.code.replace(/-/g, ''), PEPPER)));
    expect(hint).toBe(body.code.slice(-2));
    expect(JSON.stringify(vi.mocked(deps.replace).mock.calls)).not.toContain(body.code.replace(/-/g, ''));
  });

  it('validates custom codes and maps conflicts', async () => {
    const auth = { Authorization: 'Bearer admin-jwt' };
    const handler = createAdminAccessCodeHandler(adminDeps());
    expect((await handler(post({ profileId: 'not-a-uuid', mode: 'generate' }, auth))).status).toBe(400);
    expect((await handler(post({ profileId: PROFILE, mode: 'custom', code: '123' }, auth))).status).toBe(400);
    expect((await handler(post({ profileId: PROFILE, mode: 'custom', code: '111111' }, auth))).status).toBe(422);
    expect((await handler(post({ profileId: PROFILE, mode: 'custom', code: '904713', allowWeak: true }, auth))).status).toBe(200);
    const taken = createAdminAccessCodeHandler(adminDeps({ replace: async () => ({ status: 'code_taken' }) }));
    expect((await taken(post({ profileId: PROFILE, mode: 'generate' }, auth))).status).toBe(409);
  });
});

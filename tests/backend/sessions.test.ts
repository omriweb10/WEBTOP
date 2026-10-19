/** Access-code login and the single-active-session rule, end to end. */
import { describe, expect, it } from 'vitest';
import { adminClient, callFunction, createStudent, freshIp, loginStudent, sql, stackAvailable, uniqueDigits } from './helpers';

describe.skipIf(!stackAvailable)('access-code sessions', () => {
  it('lets exactly one of many concurrent logins with the same code succeed', async () => {
    const { code } = await createStudent();
    const attempts = await Promise.all(
      Array.from({ length: 12 }, (_, i) => callFunction('student-login', { code, device: `device ${i}` })),
    );
    const statuses = attempts.map((a) => a.status).sort();
    expect(statuses.filter((s) => s === 200)).toHaveLength(1);
    expect(statuses.filter((s) => s === 409)).toHaveLength(11);
    expect(attempts.every((a) => a.status === 200 || a.body.error === 'code_in_use')).toBe(true);
  });

  it('accepts the code case- and dash-insensitively and loads only that student', async () => {
    const { code, profileId } = await createStudent({ display_name: 'דנה' });
    const login = await loginStudent(` ${code.toLowerCase().replace(/-/g, ' ')} `);
    expect(login.status).toBe(200);
    const { data, error } = await login.client.rpc('get_my_bundle');
    expect(error).toBeNull();
    expect(data.profile).toMatchObject({ id: profileId, display_name: 'דנה' });
    expect(data.profile).not.toHaveProperty('auth_user_id');
  });

  it('rejects device B while device A is signed in, then allows B after A logs out', async () => {
    const { code } = await createStudent();
    const a = await loginStudent(code);
    expect(a.status).toBe(200);
    const b = await loginStudent(code);
    expect(b.status).toBe(409);
    expect(b.body.error).toBe('code_in_use');

    expect((await a.client.rpc('end_my_session')).data).toBe(true);
    await a.client.auth.signOut();
    expect((await a.client.rpc('get_my_session')).data).toBeNull();

    const bAgain = await loginStudent(code);
    expect(bAgain.status).toBe(200);
  });

  it('never releases a session because of inactivity', async () => {
    const { code, profileId } = await createStudent();
    const a = await loginStudent(code);
    await sql(`update public.user_sessions set last_seen_at = now() - interval '400 days', activated_at = now() - interval '400 days'
               where profile_id = $1 and status = 'active'`, [profileId]);
    expect((await a.client.rpc('get_my_bundle')).error).toBeNull();
    expect((await loginStudent(code)).status).toBe(409);
  });

  it('keeps the session across token refreshes (rotating refresh tokens)', async () => {
    const { code } = await createStudent();
    const a = await loginStudent(code);
    const before = (await a.client.auth.getSession()).data.session;
    const { data, error } = await a.client.auth.refreshSession();
    expect(error).toBeNull();
    // A new refresh token is issued on every refresh (rotation); the old one is retired.
    expect(data.session?.refresh_token).not.toBe(before?.refresh_token);
    expect(data.session?.expires_at).toBeGreaterThanOrEqual(before?.expires_at ?? 0);
    expect((await a.client.rpc('get_my_bundle')).error).toBeNull();
    // Access tokens are short-lived (1 hour), never permanent.
    expect((data.session?.expires_in ?? 0)).toBeLessThanOrEqual(3600);
  });

  it('admin force-disconnect ends access immediately, revokes refresh tokens and frees the code', async () => {
    const admin = await adminClient();
    const { code, profileId } = await createStudent();
    const a = await loginStudent(code);
    const [session] = await sql<{ id: string }>(`select id from public.user_sessions where profile_id = $1 and status = 'active'`, [profileId]);
    expect((await admin.rpc('admin_disconnect_session', { p_session_id: session?.id })).data).toBe(true);

    const denied = await a.client.rpc('get_my_bundle');
    expect(denied.error?.code).toBe('42501');
    expect((await a.client.auth.refreshSession()).error).not.toBeNull();
    expect((await loginStudent(code)).status).toBe(200);
  });

  it('rejects revoked codes and ends their session', async () => {
    const admin = await adminClient();
    const { code, profileId } = await createStudent();
    const a = await loginStudent(code);
    const [row] = await sql<{ id: string }>(`select id from public.access_codes where profile_id = $1 and status = 'active'`, [profileId]);
    expect((await admin.rpc('admin_revoke_access_code', { p_code_id: row?.id })).data).toBe(true);
    expect((await a.client.rpc('get_my_bundle')).error?.code).toBe('42501');
    const again = await loginStudent(code);
    expect(again.status).toBe(401);
    expect(again.body.error).toBe('invalid_code');
  });

  it('replacing a code invalidates the old one', async () => {
    const admin = await adminClient();
    const token = (await admin.auth.getSession()).data.session?.access_token;
    const { code, profileId } = await createStudent();
    const digits = uniqueDigits(4);
    const replaced = await callFunction('admin-access-code', { profileId, mode: 'custom', code: `Blue-Orbit-${digits}-Kiwi` }, { token });
    expect(replaced.status).toBe(200);
    expect(replaced.body.code).toBe(`BLUE-ORBI-T${digits.slice(0, 3)}-${digits.slice(3)}KIW-I`);
    expect((await loginStudent(code)).status).toBe(401);
    expect((await loginStudent(`blue orbit ${digits} kiwi`)).status).toBe(200);
  });

  it('rejects disabled accounts and ends their session', async () => {
    const admin = await adminClient();
    const { code, profileId } = await createStudent();
    const a = await loginStudent(code);
    await admin.rpc('admin_set_profile_status', { p_profile_id: profileId, p_status: 'disabled' });
    expect((await a.client.rpc('get_my_bundle')).error?.code).toBe('42501');
    const again = await loginStudent(code);
    expect(again.status).toBe(403);
    expect(again.body.error).toBe('account_disabled');
  });

  it('rate-limits code guessing per IP without affecting other IPs', async () => {
    const { code } = await createStudent();
    const attacker = freshIp();
    for (let i = 0; i < 10; i += 1) {
      expect((await callFunction('student-login', { code: `WRONG-CODE-${i}` }, { ip: attacker })).status).toBe(401);
    }
    const blocked = await callFunction('student-login', { code }, { ip: attacker });
    expect(blocked.status).toBe(429);
    expect(Number(blocked.body.retry_after)).toBeGreaterThan(0);
    expect((await loginStudent(code)).status).toBe(200);
  });

  it('stores only hashes: no plaintext code anywhere in the database', async () => {
    const { code } = await createStudent();
    const normalized = code.replace(/-/g, '');
    const rows = await sql<{ hit: boolean }>(
      `select exists (select 1 from public.access_codes where encode(code_hash, 'escape') like '%' || $1 || '%'
                       or code_hint = $1) as hit`,
      [normalized],
    );
    expect(rows[0]?.hit).toBe(false);
    const [len] = await sql<{ l: number }>('select octet_length(code_hash) as l from public.access_codes limit 1');
    expect(len?.l).toBe(32);
  });

  it('clears a login that crashed between claim and activation after two minutes', async () => {
    const { code, profileId } = await createStudent();
    const [codeRow] = await sql<{ id: string }>(`select id from public.access_codes where profile_id = $1 and status = 'active'`, [profileId]);
    await sql(`insert into public.user_sessions (profile_id, access_code_id, created_at) values ($1, $2, now() - interval '3 minutes')`, [
      profileId,
      codeRow?.id,
    ]);
    expect((await loginStudent(code)).status).toBe(200);
  });
});

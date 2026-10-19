/** Personal access codes. Codes are created by the Edge Function; only hashes are stored. */
import { callAdminFunction, db, unwrap } from './adminClient';
import type { IssuedCode } from './types';

export type IssueRequest = { mode: 'generate' } | { mode: 'custom'; code: string; allowWeak: boolean };

/** Issues a new code (replacing and revoking the current one). The plaintext is returned once. */
export async function issueCode(profileId: string, request: IssueRequest): Promise<IssuedCode> {
  return callAdminFunction<IssuedCode>('admin-access-code', { profileId, ...request });
}

/** Revokes a code and ends any session that uses it. */
export async function revokeCode(codeId: string): Promise<boolean> {
  return unwrap<boolean>(db().rpc('admin_revoke_access_code', { p_code_id: codeId }));
}

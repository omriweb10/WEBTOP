/** Student profiles: list, create, edit, enable/disable, delete. */
import { db, unwrap } from './adminClient';
import type { AccountStatus, ProfileFields, UserOverview } from './types';

/** Every student with code, session and timetable summary. */
export async function listUsers(): Promise<UserOverview[]> {
  return unwrap<UserOverview[]>(db().from('admin_user_overview').select('*').order('display_name'));
}

/** Creates a profile; returns its id. */
export async function createUser(fields: ProfileFields): Promise<string> {
  const row = await unwrap<{ id: string }>(db().from('profiles').insert(fields).select('id').single());
  return row.id;
}

/** Updates personal details. */
export async function updateUser(id: string, fields: Partial<ProfileFields> & { avatar_path?: string | null }): Promise<void> {
  await unwrap(db().from('profiles').update(fields).eq('id', id));
}

/** Enables or disables an account (disabling ends its session immediately). */
export async function setUserStatus(id: string, status: AccountStatus): Promise<void> {
  await unwrap(db().rpc('admin_set_profile_status', { p_profile_id: id, p_status: status }));
}

/** Deletes a student completely; returns the avatar path that should be removed from storage. */
export async function deleteUser(id: string): Promise<string | null> {
  return unwrap<string | null>(db().rpc('admin_delete_profile', { p_profile_id: id }));
}

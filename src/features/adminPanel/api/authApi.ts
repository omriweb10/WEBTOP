/** Administrator authentication (Supabase Auth email + password, plus the admins table). */
import { db, unwrap } from './adminClient';

/** Email of the current admin session, or null. Validated with the server, not just read locally. */
export async function currentAdminEmail(): Promise<string | null> {
  const { data, error } = await db().auth.getUser();
  if (error || !data.user) return null;
  return data.user.email ?? null;
}

/** Signs in with email and password. Returns an error message or null. */
export async function signInAdmin(email: string, password: string): Promise<string | null> {
  const { error } = await db().auth.signInWithPassword({ email: email.trim(), password });
  if (!error) return null;
  if (/invalid login credentials/i.test(error.message)) return 'האימייל או הסיסמה שגויים.';
  if (error.status === 429) return 'יותר מדי ניסיונות. נסו שוב בעוד כמה דקות.';
  return 'ההתחברות נכשלה. נסו שוב.';
}

/** True when the signed-in user is listed in public.admins (checked by the database). */
export async function isAdmin(): Promise<boolean> {
  return (await unwrap<boolean>(db().rpc('is_admin'))) === true;
}

/** Ends the admin session (refresh tokens are revoked on the server). */
export async function signOutAdmin(): Promise<void> {
  await db().auth.signOut();
}

/** Shared plumbing for admin API calls: the admin client and error normalisation. */
import type { SupabaseClient } from '@supabase/supabase-js';
import { getAdminClient, requireBackend } from '../../../services/supabase/clients';
import { AdminError, toAdminError } from '../domain/adminErrors';

/** The admin's Supabase client. */
export function db(): SupabaseClient {
  return getAdminClient();
}

/** Awaits a Supabase query and returns its data, throwing an AdminError on failure. */
export async function unwrap<T>(query: PromiseLike<{ data: unknown; error: unknown }>): Promise<T> {
  let result: { data: unknown; error: unknown };
  try {
    result = await query;
  } catch (error) {
    throw toAdminError(error);
  }
  if (result.error) throw toAdminError(result.error);
  return result.data as T;
}

/** Calls an Edge Function with the admin's access token and returns its JSON body. */
export async function callAdminFunction<T>(name: string, body: unknown): Promise<T> {
  const { url, anonKey } = requireBackend();
  const token = (await db().auth.getSession()).data.session?.access_token;
  if (!token) throw new AdminError('admin_required', 'ההתחברות כמנהל פגה. התחברו מחדש.');
  let response: Response;
  try {
    response = await fetch(`${url}/functions/v1/${name}`, {
      method: 'POST',
      headers: { apikey: anonKey, Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    });
  } catch (error) {
    throw toAdminError(error);
  }
  const json = (await response.json().catch(() => ({}))) as Record<string, unknown>;
  if (!response.ok) {
    const failure = toAdminError({ message: json.error ?? `http_${response.status}` });
    throw Object.assign(failure, { details: json });
  }
  return json as T;
}

/**
 * Supabase clients. Students and admins use separate clients with separate storage keys,
 * so an admin signing in on a shared device never touches a student's session.
 * Sessions persist in localStorage and renew through rotating refresh tokens.
 */
import { createClient, type SupabaseClient } from '@supabase/supabase-js';
import { backendConfig, type BackendConfig } from '../../config/backend';

export const STUDENT_AUTH_STORAGE_KEY = 'webtop-pwa:student-auth';
export const ADMIN_AUTH_STORAGE_KEY = 'webtop-pwa:admin-auth';

let studentClient: SupabaseClient | null = null;
let adminClient: SupabaseClient | null = null;

/** The configured backend, or an error for code paths that require one. */
export function requireBackend(): BackendConfig {
  if (!backendConfig) throw new Error('Supabase is not configured for this build');
  return backendConfig;
}

/** Creates a client bound to one auth storage key. */
function makeClient(storageKey: string): SupabaseClient {
  const { url, anonKey } = requireBackend();
  return createClient(url, anonKey, {
    auth: { storageKey, persistSession: true, autoRefreshToken: true, detectSessionInUrl: false },
  });
}

/** Client holding the signed-in student's session. */
export function getStudentClient(): SupabaseClient {
  studentClient ??= makeClient(STUDENT_AUTH_STORAGE_KEY);
  return studentClient;
}

/** Client holding the administrator's session (admin panel only). */
export function getAdminClient(): SupabaseClient {
  adminClient ??= makeClient(ADMIN_AUTH_STORAGE_KEY);
  return adminClient;
}

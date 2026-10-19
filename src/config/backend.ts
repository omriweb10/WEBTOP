/**
 * Backend configuration. When the build has a Supabase URL and anon key the app runs in
 * account mode: students sign in with a personal access code and their data lives on the
 * server. Without them it is the original local-only app, unchanged.
 */
export interface BackendConfig {
  url: string;
  anonKey: string;
}

/** Validates the two build variables; anything incomplete or malformed means "no backend". */
export function parseBackendConfig(env: { VITE_SUPABASE_URL?: string; VITE_SUPABASE_ANON_KEY?: string }): BackendConfig | null {
  const url = env.VITE_SUPABASE_URL?.trim().replace(/\/+$/, '') ?? '';
  const anonKey = env.VITE_SUPABASE_ANON_KEY?.trim() ?? '';
  if (!url || !anonKey) return null;
  try {
    const parsed = new URL(url);
    if (parsed.protocol !== 'https:' && parsed.hostname !== '127.0.0.1' && parsed.hostname !== 'localhost') return null;
  } catch {
    return null;
  }
  return { url, anonKey };
}

export const backendConfig = parseBackendConfig(import.meta.env);

/** True when students must sign in with an access code (Supabase configured). */
export const accountMode = backendConfig !== null;

/**
 * Classifies backend failures so the UI can react correctly: a session the server no
 * longer accepts must sign the device out, while a network problem must not.
 */

/** Minimal shape shared by PostgREST, Auth and fetch errors. */
interface ErrorLike {
  code?: unknown;
  status?: unknown;
  name?: unknown;
  message?: unknown;
}

/** Reads a field from an unknown error value. */
function field(error: unknown, key: keyof ErrorLike): unknown {
  return typeof error === 'object' && error !== null ? (error as ErrorLike)[key] : undefined;
}

/** True when the server says this session is over (disconnected, revoked, disabled, logged out). */
export function isSessionEndedError(error: unknown): boolean {
  const code = field(error, 'code');
  const message = String(field(error, 'message') ?? '');
  const name = String(field(error, 'name') ?? '');
  if (code === '42501' || /session_inactive/.test(message)) return true;
  if (code === 'refresh_token_not_found' || code === 'session_not_found' || code === 'refresh_token_already_used') return true;
  if (name === 'AuthSessionMissingError') return true;
  return /refresh token (not found|is invalid)|invalid refresh token|session (not found|missing)/i.test(message);
}

/** True for failures caused by connectivity rather than by the server's answer. */
export function isNetworkError(error: unknown): boolean {
  const name = String(field(error, 'name') ?? '');
  const message = String(field(error, 'message') ?? '');
  const status = field(error, 'status');
  if (name === 'AuthRetryableFetchError') return true;
  if (status === 0) return true;
  return /failed to fetch|network|load failed|fetch failed|timeout/i.test(message);
}

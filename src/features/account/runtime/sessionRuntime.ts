/**
 * Student session lifecycle in account mode.
 *
 * - A session lasts until the student logs out, the admin disconnects it, or the code or
 *   account is revoked. Nothing here ends a session because of time or inactivity.
 * - The stored session is never taken as proof: at start-up and regularly afterwards the
 *   server is asked, and every data request is authorised there from the live session.
 * - Access tokens are short-lived; supabase-js renews them with rotating refresh tokens.
 * - Offline, the last confirmed copy stays visible and is re-validated once back online.
 */
import { STUDENT_AUTH_STORAGE_KEY, getStudentClient } from '../../../services/supabase/clients';
import { isNetworkError, isSessionEndedError } from '../../../services/supabase/errors';
import { localStore } from '../../../services/storage/appStorage';
import { setTimetableChangeListener } from '../../timetable/timetableActions';
import { useAccountCache, useAccountStore, type LogoutResult } from '../accountStore';
import { endMySession, endSessionWithToken, fetchBundle, requestLogin, signedAvatarUrl, touchSession } from '../api/studentApi';
import { mapBundle } from '../domain/bundle';
import { describeDevice } from '../domain/deviceLabel';
import type { LoginFailure } from '../domain/loginMessages';
import { applySnapshot, clearAccountData } from './accountData';
import { initTimetableSync, isTimetableSynced, queueTimetableSave, setConfirmedTimetable } from './timetableSync';

const HEARTBEAT_MS = 60_000;
const REFRESH_MS = 5 * 60_000;
const MIN_REFRESH_GAP_MS = 20_000;

let started = false;
let timers: number[] = [];
let lastRefreshAt = 0;
let refreshing: Promise<void> | null = null;
let signingOut = false;

/** True when this browser still holds a student session from an earlier visit. */
function hasStoredSession(): boolean {
  return localStore.get(STUDENT_AUTH_STORAGE_KEY) !== null;
}

/** Running as an installed home-screen app. */
function isStandalone(): boolean {
  return window.matchMedia?.('(display-mode: standalone)').matches || (navigator as { standalone?: boolean }).standalone === true;
}

/** Signs the device out locally and wipes the account's data. */
async function finishSignOut(reason: 'logout' | 'ended'): Promise<void> {
  signingOut = true;
  stopTimers();
  try {
    await getStudentClient().auth.signOut({ scope: 'local' });
  } catch {
    /* local sign-out cannot meaningfully fail; storage is cleared below anyway */
  }
  localStore.remove(STUDENT_AUTH_STORAGE_KEY);
  clearAccountData();
  useAccountStore.setState({ phase: 'signed-out', offline: false, avatarUrl: null, signOutReason: reason });
  signingOut = false;
}

/** The server no longer accepts this session (disconnected, revoked, disabled). */
function sessionEnded(): void {
  if (signingOut || useAccountStore.getState().phase === 'signed-out') return;
  void finishSignOut('ended');
}

/** Marks the app offline, falling back to the cached copy when there is one. */
function goOffline(): void {
  const cached = useAccountCache.getState().value;
  useAccountStore.setState({ phase: cached ? 'signed-in' : 'unreachable', offline: true });
}

/** Loads the account from the server and applies it. */
async function refresh(): Promise<void> {
  if (refreshing) return refreshing;
  refreshing = (async () => {
    lastRefreshAt = Date.now();
    const result = await fetchBundle();
    if (!result.ok) {
      if (isSessionEndedError(result.error)) sessionEnded();
      else if (isNetworkError(result.error)) goOffline();
      else {
        console.error('[account] could not load the account', result.error);
        goOffline();
      }
      return;
    }
    const snapshot = mapBundle(result.data);
    const includeTimetable = useAccountStore.getState().phase !== 'signed-in' || isTimetableSynced();
    applySnapshot(snapshot, includeTimetable);
    if (includeTimetable) setConfirmedTimetable(snapshot.timetable);
    useAccountStore.setState({ phase: 'signed-in', offline: false, signOutReason: null });
    startTimers();
    const path = snapshot.summary.avatarPath;
    useAccountStore.setState({ avatarUrl: path ? await signedAvatarUrl(path) : null });
  })().finally(() => {
    refreshing = null;
  });
  return refreshing;
}

/** Refreshes unless that happened very recently. */
function refreshSoon(): void {
  if (Date.now() - lastRefreshAt >= MIN_REFRESH_GAP_MS) void refresh();
}

/** Heartbeat for the admin's "connected now" indicator. It never ends anything itself. */
async function heartbeat(): Promise<void> {
  if (document.visibilityState !== 'visible' || useAccountStore.getState().phase !== 'signed-in') return;
  const result = await touchSession();
  if (result.ok) {
    if (!result.data) sessionEnded();
    else if (useAccountStore.getState().offline) void refresh();
  } else if (isSessionEndedError(result.error)) {
    sessionEnded();
  } else if (isNetworkError(result.error)) {
    useAccountStore.setState({ offline: true });
  }
}

/** Starts the periodic heartbeat and refresh (idempotent). */
function startTimers(): void {
  if (timers.length > 0) return;
  timers = [window.setInterval(() => void heartbeat(), HEARTBEAT_MS), window.setInterval(refreshSoon, REFRESH_MS)];
  void heartbeat();
}

/** Stops the periodic work. */
function stopTimers(): void {
  timers.forEach((id) => window.clearInterval(id));
  timers = [];
}

/** Access-code login. Returns null on success or the reason it failed. */
async function login(code: string): Promise<LoginFailure | null> {
  const response = await requestLogin(code, describeDevice(navigator.userAgent, isStandalone()));
  if (!response.ok) return response.failure;
  const { error } = await getStudentClient().auth.setSession(response.session);
  if (error) {
    // The server already counts this device as signed in; release the code again.
    await endSessionWithToken(response.session.access_token);
    return isNetworkError(error) ? { kind: 'offline' } : { kind: 'unavailable' };
  }
  await refresh();
  const phase = useAccountStore.getState().phase;
  return phase === 'signed-in' ? null : { kind: 'unavailable' };
}

/** Explicit logout. It must reach the server, otherwise the code would stay locked. */
async function logout(): Promise<LogoutResult> {
  const result = await endMySession();
  if (!result.ok && isNetworkError(result.error)) return 'offline';
  if (!result.ok && !isSessionEndedError(result.error)) return 'failed';
  await finishSignOut('logout');
  return 'ok';
}

/** Validates the stored session at start-up. */
async function resume(): Promise<void> {
  const client = getStudentClient();
  const { data, error } = await client.auth.getSession();
  if (data.session) {
    await refresh();
    return;
  }
  if (error && isNetworkError(error) && hasStoredSession()) {
    goOffline();
    return;
  }
  clearAccountData();
  useAccountStore.setState({ phase: 'signed-out', offline: false });
}

/** Boots the runtime once per page load. */
export function startAccountRuntime(): void {
  if (started) return;
  started = true;

  useAccountStore.setState({ actions: { login, logout, refresh } });
  initTimetableSync({ onSessionEnded: sessionEnded, onStale: () => void refresh() });
  setTimetableChangeListener(queueTimetableSave);

  // supabase-js reports a refresh token the server rejected as SIGNED_OUT.
  getStudentClient().auth.onAuthStateChange((event) => {
    if (event === 'SIGNED_OUT' && useAccountStore.getState().phase === 'signed-in') {
      window.setTimeout(sessionEnded, 0);
    }
  });

  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'visible' && useAccountStore.getState().phase !== 'signed-out') refreshSoon();
  });
  window.addEventListener('online', () => {
    if (useAccountStore.getState().phase !== 'signed-out') void refresh();
  });

  void resume();
}

/**
 * Account-mode state shared by the whole app. It has no backend dependency: the session
 * runtime (loaded lazily with the Supabase client) fills it in and registers its actions,
 * so screens can read the account and offer logout without pulling in the client.
 */
import { create } from 'zustand';
import type { PersistedValueSpec } from '../../services/storage/persistedValue';
import { createPersistedStore } from '../../store/createPersistedStore';
import { AccountSummarySchema, type AccountSummary } from './domain/bundle';
import type { LoginFailure, SignOutReason } from './domain/loginMessages';

const accountCacheSlice: PersistedValueSpec<AccountSummary | null> = {
  key: 'webtop-pwa:account',
  version: 1,
  schema: AccountSummarySchema.nullable(),
  defaults: () => null,
};

/** The signed-in account as last confirmed by the server (kept for offline starts). */
export const useAccountCache = createPersistedStore(accountCacheSlice);

/**
 * starting     – checking the stored session with the server
 * signed-out   – no session: show the access-code screen
 * signed-in    – session confirmed (or, while offline, the cached copy is shown)
 * unreachable  – a stored session exists but the server cannot be reached and nothing is cached
 */
export type AccountPhase = 'starting' | 'signed-out' | 'signed-in' | 'unreachable';

export type LogoutResult = 'ok' | 'offline' | 'failed';

export interface AccountActions {
  login: (code: string) => Promise<LoginFailure | null>;
  logout: () => Promise<LogoutResult>;
  /** Re-reads the account from the server (also retries after being offline). */
  refresh: () => Promise<void>;
}

interface AccountState {
  phase: AccountPhase;
  /** Signed in but the last server call failed for connectivity reasons. */
  offline: boolean;
  /** Short-lived signed URL of the profile picture, when there is one. */
  avatarUrl: string | null;
  /** Why the device was last signed out (shown once on the login screen). */
  signOutReason: SignOutReason | null;
  actions: AccountActions | null;
}

export const useAccountStore = create<AccountState>()(() => ({
  phase: 'starting',
  offline: false,
  avatarUrl: null,
  signOutReason: null,
  actions: null,
}));

/** The signed-in account summary (null in local mode or when signed out). */
export function useAccountSummary(): AccountSummary | null {
  return useAccountCache((state) => state.value);
}

/** Administrator sign-in state for the panel. */
import { create } from 'zustand';
import { currentAdminEmail, isAdmin, signInAdmin, signOutAdmin } from '../api/authApi';
import { errorMessage } from '../domain/adminErrors';
import { resetAdminCaches } from './resources';

type Phase = 'checking' | 'signed-out' | 'ready';

interface AdminAuthState {
  phase: Phase;
  email: string | null;
  /** Message shown on the sign-in form. */
  notice: string | null;
  check: () => Promise<void>;
  signIn: (email: string, password: string) => Promise<boolean>;
  signOut: () => Promise<void>;
}

export const useAdminAuth = create<AdminAuthState>()((set) => {
  /** Confirms with the server that the signed-in user is an admin. */
  const verify = async (): Promise<boolean> => {
    const email = await currentAdminEmail();
    if (!email) {
      set({ phase: 'signed-out', email: null });
      return false;
    }
    if (!(await isAdmin())) {
      await signOutAdmin();
      set({ phase: 'signed-out', email: null, notice: 'החשבון הזה אינו מוגדר כמנהל.' });
      return false;
    }
    set({ phase: 'ready', email, notice: null });
    return true;
  };

  return {
    phase: 'checking',
    email: null,
    notice: null,
    check: async () => {
      try {
        await verify();
      } catch (error) {
        set({ phase: 'signed-out', notice: errorMessage(error) });
      }
    },
    signIn: async (email, password) => {
      const failure = await signInAdmin(email, password);
      if (failure) {
        set({ notice: failure });
        return false;
      }
      try {
        return await verify();
      } catch (error) {
        set({ phase: 'signed-out', notice: errorMessage(error) });
        return false;
      }
    },
    signOut: async () => {
      await signOutAdmin().catch(() => undefined);
      resetAdminCaches();
      set({ phase: 'signed-out', email: null, notice: 'התנתקת מממשק הניהול.' });
    },
  };
});

/**
 * The three "stop this person" actions shared by the sessions dashboard and the user page.
 * Each asks for confirmation, calls the server and refreshes the affected lists.
 */
import { confirm } from '../../../components/ui/confirmStore';
import { toast } from '../../../store/uiStore';
import { revokeCode } from '../api/codesApi';
import { disconnectSession } from '../api/sessionsApi';
import { setUserStatus } from '../api/usersApi';
import { reloadPeopleViews } from '../state/resources';
import { errorMessage } from './adminErrors';

/** Runs a server action with toasts and a refresh. */
async function run(action: () => Promise<unknown>, success: string): Promise<void> {
  try {
    await action();
    toast(success, { tone: 'success' });
  } catch (error) {
    toast(errorMessage(error), { tone: 'error' });
  } finally {
    reloadPeopleViews();
  }
}

/** Force Disconnect: ends the session now; the code stays valid for a new login. */
export async function forceDisconnect(sessionId: string, name: string): Promise<void> {
  const ok = await confirm({
    title: 'ניתוק בכוח',
    message: `לנתק את ${name} מהמכשיר המחובר? הגישה תיחסם מיד, והקוד יתפנה להתחברות ממכשיר אחר.`,
    confirmLabel: 'ניתוק',
    tone: 'danger',
  });
  if (ok) await run(() => disconnectSession(sessionId), 'החיבור נותק');
}

/** Revokes the code (and ends its session); a new code must be issued to sign in again. */
export async function revokeAccessCode(codeId: string, name: string): Promise<void> {
  const ok = await confirm({
    title: 'ביטול קוד',
    message: `לבטל את קוד הגישה של ${name}? הוא יפסיק לעבוד מיד וכל חיבור איתו ינותק.`,
    confirmLabel: 'ביטול הקוד',
    tone: 'danger',
  });
  if (ok) await run(() => revokeCode(codeId), 'הקוד בוטל');
}

/** Disables the account (and ends its session). */
export async function disableAccount(profileId: string, name: string): Promise<void> {
  const ok = await confirm({
    title: 'השבתת חשבון',
    message: `להשבית את החשבון של ${name}? החיבור ינותק מיד, ולא יהיה אפשר להתחבר עד הפעלה מחדש.`,
    confirmLabel: 'השבתה',
    tone: 'danger',
  });
  if (ok) await run(() => setUserStatus(profileId, 'disabled'), 'החשבון הושבת');
}

/** User-facing outcomes of an access-code login attempt (Hebrew copy lives here only). */

export type LoginFailure =
  | { kind: 'invalid_code' }
  | { kind: 'account_disabled' }
  | { kind: 'code_in_use' }
  | { kind: 'rate_limited'; retryAfterSeconds: number }
  | { kind: 'interrupted' }
  | { kind: 'unavailable' }
  | { kind: 'offline' };

/** Maps the student-login function's HTTP answer to a failure kind. */
export function loginFailureFromResponse(status: number, body: { error?: unknown; retry_after?: unknown }): LoginFailure {
  switch (body.error) {
    case 'invalid_code':
      return { kind: 'invalid_code' };
    case 'account_disabled':
      return { kind: 'account_disabled' };
    case 'code_in_use':
      return { kind: 'code_in_use' };
    case 'login_interrupted':
      return { kind: 'interrupted' };
    case 'rate_limited':
      return { kind: 'rate_limited', retryAfterSeconds: Math.max(1, Number(body.retry_after) || 60) };
    default:
      return status === 400 || status === 401 ? { kind: 'invalid_code' } : { kind: 'unavailable' };
  }
}

/** Rounds a wait to whole minutes for display. */
function minutes(seconds: number): string {
  const value = Math.max(1, Math.ceil(seconds / 60));
  return value === 1 ? 'דקה' : `${value} דקות`;
}

/** Explanation shown under the code field. */
export function loginFailureMessage(failure: LoginFailure): string {
  switch (failure.kind) {
    case 'invalid_code':
      return 'הקוד שגוי או שאינו פעיל עוד. בדקו אותו או פנו למנהל המערכת.';
    case 'account_disabled':
      return 'החשבון הזה הושבת. לפרטים פנו למנהל המערכת.';
    case 'code_in_use':
      return 'הקוד הזה כבר מחובר במכשיר אחר. כדי להתחבר כאן יש להתנתק קודם במכשיר השני, או לבקש מהמנהל לנתק את החיבור.';
    case 'rate_limited':
      return `יותר מדי ניסיונות כושלים. אפשר לנסות שוב בעוד ${minutes(failure.retryAfterSeconds)}.`;
    case 'interrupted':
      return 'ההתחברות נקטעה. נסו שוב.';
    case 'unavailable':
      return 'השרת אינו זמין כרגע. נסו שוב בעוד כמה רגעים.';
    case 'offline':
      return 'אין חיבור לרשת. ההתחברות דורשת חיבור לאינטרנט.';
  }
}

/** Why the device was signed out, shown once on the login screen. */
export type SignOutReason = 'logout' | 'ended';

export function signOutMessage(reason: SignOutReason): string {
  return reason === 'logout'
    ? 'התנתקת. הקוד שלך זמין עכשיו להתחברות בכל מכשיר.'
    : 'החיבור הסתיים: המנהל ניתק אותו, הקוד הוחלף או בוטל, או שהחשבון הושבת. אם קיבלת קוד חדש, הזינו אותו כאן.';
}

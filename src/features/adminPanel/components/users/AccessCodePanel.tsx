import { useState } from 'react';
import { Button } from '../../../../components/ui/Button';
import { confirm } from '../../../../components/ui/confirmStore';
import { toast } from '../../../../store/uiStore';
import { issueCode, revokeCode, type IssueRequest } from '../../api/codesApi';
import type { IssuedCode, UserOverview } from '../../api/types';
import { errorMessage } from '../../domain/adminErrors';
import { formatDateTime, formatRelative } from '../../domain/formatters';
import { reloadPeopleViews } from '../../state/resources';
import { Panel } from '../shared/Page';
import { CustomCodeForm } from './CustomCodeForm';
import { ShowCodeDialog } from './ShowCodeDialog';
import styles from './users.module.css';

/** Strength in words for an existing code. */
function strengthLabel(bits: number | null): string {
  if (bits === null) return '—';
  return bits >= 55 ? `חזק (${bits} ביט)` : bits >= 40 ? `בינוני (${bits} ביט)` : `חלש (${bits} ביט)`;
}

/** Issue, replace and revoke a student's personal access code. */
export function AccessCodePanel({ user }: { user: UserOverview }) {
  const [custom, setCustom] = useState(false);
  const [busy, setBusy] = useState(false);
  const [issued, setIssued] = useState<IssuedCode | null>(null);
  const hasCode = Boolean(user.code_id);

  /** Confirms a replacement when a code (and maybe a session) already exists. */
  const confirmReplace = async () => {
    if (!hasCode) return true;
    return confirm({
      title: 'החלפת קוד',
      message: user.session_id
        ? 'הקוד הנוכחי יבוטל והמכשיר המחובר כעת ינותק מיד. להמשיך?'
        : 'הקוד הנוכחי יבוטל ולא יעבוד יותר. להמשיך?',
      confirmLabel: 'החלפה',
      tone: 'danger',
    });
  };

  /** Issues a code through the server and shows it once. */
  const issue = async (request: IssueRequest) => {
    if (!(await confirmReplace())) return;
    setBusy(true);
    try {
      setIssued(await issueCode(user.id, request));
      setCustom(false);
      reloadPeopleViews();
    } catch (error) {
      toast(errorMessage(error), { tone: 'error', duration: 6000 });
    } finally {
      setBusy(false);
    }
  };

  /** Revokes the active code (also ends its session). */
  const revoke = async () => {
    if (!user.code_id) return;
    const ok = await confirm({
      title: 'ביטול קוד',
      message: 'לבטל את הקוד? הוא יפסיק לעבוד מיד, וכל מכשיר שמחובר איתו ינותק.',
      confirmLabel: 'ביטול הקוד',
      tone: 'danger',
    });
    if (!ok) return;
    try {
      await revokeCode(user.code_id);
      toast('הקוד בוטל', { tone: 'success' });
      reloadPeopleViews();
    } catch (error) {
      toast(errorMessage(error), { tone: 'error' });
    }
  };

  return (
    <Panel title="קוד גישה אישי" id="user-code">
      {hasCode ? (
        <dl className={styles.facts}>
          <dt>קוד פעיל</dt>
          <dd dir="ltr">…{user.code_hint}</dd>
          <dt>חוזק</dt>
          <dd>{strengthLabel(user.strength_bits)}</dd>
          <dt>הונפק</dt>
          <dd>{formatDateTime(user.code_created_at)}</dd>
          <dt>שימוש אחרון</dt>
          <dd>{user.code_last_used_at ? `${formatRelative(user.code_last_used_at)} (${formatDateTime(user.code_last_used_at)})` : 'עדיין לא נעשה בו שימוש'}</dd>
          <dt>מחובר כעת</dt>
          <dd>{user.session_id ? `כן — ${user.session_device || 'מכשיר לא מזוהה'}` : 'לא'}</dd>
        </dl>
      ) : (
        <p className={styles.note}>אין למשתמש קוד פעיל, ולכן הוא לא יכול להתחבר. הנפיקו קוד חדש.</p>
      )}
      <p className={styles.note}>
        במערכת נשמר רק טביעה מוצפנת (HMAC) של הקוד. הקוד עצמו מוצג פעם אחת — מיד אחרי ההנפקה או ההחלפה.
      </p>
      {custom ? (
        <CustomCodeForm busy={busy} onCancel={() => setCustom(false)} onSubmit={(code, allowWeak) => void issue({ mode: 'custom', code, allowWeak })} />
      ) : (
        <div className={styles.actions}>
          <Button icon="key" variant="primary" disabled={busy} onClick={() => void issue({ mode: 'generate' })}>
            {hasCode ? 'החלפה בקוד חזק חדש' : 'הנפקת קוד חזק'}
          </Button>
          <Button icon="edit" disabled={busy} onClick={() => setCustom(true)}>
            קוד מותאם אישית…
          </Button>
          {hasCode && (
            <Button icon="block" variant="danger" disabled={busy} onClick={() => void revoke()}>
              ביטול הקוד
            </Button>
          )}
        </div>
      )}
      {issued && <ShowCodeDialog issued={issued} studentName={user.display_name} onClose={() => setIssued(null)} />}
    </Panel>
  );
}

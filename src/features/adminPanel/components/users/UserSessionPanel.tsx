import { Button } from '../../../../components/ui/Button';
import type { UserOverview } from '../../api/types';
import { formatDateTime, formatRelative } from '../../domain/formatters';
import { disableAccount, forceDisconnect, revokeAccessCode } from '../../domain/sessionActions';
import { Panel } from '../shared/Page';
import { ConnectionBadge } from './ConnectionBadge';
import styles from './users.module.css';

/** The student's current session (one device at most) and the ways to end it. */
export function UserSessionPanel({ user }: { user: UserOverview }) {
  return (
    <Panel title="חיבור נוכחי" id="user-session" actions={<ConnectionBadge lastSeenAt={user.session_last_seen_at} hasSession={Boolean(user.session_id)} />}>
      {user.session_id ? (
        <dl className={styles.facts}>
          <dt>מכשיר</dt>
          <dd>{user.session_device || 'לא מזוהה'}</dd>
          <dt>התחיל</dt>
          <dd>{formatDateTime(user.session_started_at)}</dd>
          <dt>פעילות אחרונה</dt>
          <dd>{user.session_last_seen_at ? `${formatRelative(user.session_last_seen_at)} (${formatDateTime(user.session_last_seen_at)})` : '—'}</dd>
          <dt>תפוגה</dt>
          <dd>ללא — החיבור נשאר עד התנתקות, ניתוק על ידי מנהל, או ביטול הקוד/החשבון</dd>
        </dl>
      ) : (
        <p className={styles.note}>המשתמש אינו מחובר כעת באף מכשיר.</p>
      )}
      <p className={styles.note}>כל קוד מחובר במכשיר אחד לכל היותר. התחברות ממכשיר נוסף נדחית עד שהחיבור הנוכחי מסתיים.</p>
      <div className={styles.actions}>
        {user.session_id && (
          <Button icon="linkOff" variant="danger" onClick={() => void forceDisconnect(user.session_id ?? '', user.display_name)}>
            ניתוק בכוח
          </Button>
        )}
        {user.code_id && (
          <Button icon="block" onClick={() => void revokeAccessCode(user.code_id ?? '', user.display_name)}>
            ביטול הקוד
          </Button>
        )}
        {user.status === 'active' && (
          <Button icon="block" onClick={() => void disableAccount(user.id, user.display_name)}>
            השבתת החשבון
          </Button>
        )}
      </div>
    </Panel>
  );
}

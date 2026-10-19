import { navigate } from '../../../../app/router';
import { Avatar } from '../../../../components/ui/Avatar';
import { Button } from '../../../../components/ui/Button';
import type { SessionOverview } from '../../api/types';
import { endReasonLabel, formatDateTime, formatRelative } from '../../domain/formatters';
import { disableAccount, forceDisconnect, revokeAccessCode } from '../../domain/sessionActions';
import { Badge } from '../shared/Badge';
import { ConnectionBadge } from '../users/ConnectionBadge';
import styles from './sessions.module.css';

/** One session: who, which device, since when, last activity, and the stop controls. */
export function SessionCard({ session, avatarUrl }: { session: SessionOverview; avatarUrl?: string }) {
  const live = session.status !== 'ended';
  return (
    <article className={styles.card}>
      <header className={styles.cardHeader}>
        <button type="button" className={styles.person} onClick={() => navigate({ name: 'admin', section: 'users', id: session.profile_id })}>
          <Avatar name={session.display_name} src={avatarUrl} size={44} />
          <span>
            <span className={styles.name}>{session.display_name}</span>
            <span className={styles.meta}>{session.class_name || 'ללא כיתה'}</span>
          </span>
        </button>
        {live ? (
          session.status === 'pending' ? <Badge tone="warning">בתהליך התחברות</Badge> : <ConnectionBadge lastSeenAt={session.last_seen_at} hasSession />
        ) : (
          <Badge>הסתיים</Badge>
        )}
      </header>
      <dl className={styles.facts}>
        <dt>מכשיר</dt>
        <dd>{session.device_label || 'לא מזוהה'}</dd>
        <dt>התחלה</dt>
        <dd>{formatDateTime(session.activated_at ?? session.created_at)}</dd>
        <dt>פעילות אחרונה</dt>
        <dd>{formatRelative(session.last_seen_at)}</dd>
        {live ? (
          <>
            <dt>תפוגה</dt>
            <dd>ללא — עד ניתוק</dd>
          </>
        ) : (
          <>
            <dt>הסתיים</dt>
            <dd>
              {formatDateTime(session.ended_at)} · {endReasonLabel(session.end_reason)}
            </dd>
          </>
        )}
        <dt>קוד</dt>
        <dd>
          <span dir="ltr">…{session.code_hint}</span> {session.code_status === 'revoked' && '(בוטל)'}
        </dd>
      </dl>
      {live && (
        <div className={styles.actions}>
          <Button icon="linkOff" variant="danger" onClick={() => void forceDisconnect(session.id, session.display_name)}>
            ניתוק בכוח
          </Button>
          {session.code_status === 'active' && (
            <Button icon="block" onClick={() => void revokeAccessCode(session.access_code_id, session.display_name)}>
              ביטול קוד
            </Button>
          )}
          {session.profile_status === 'active' && (
            <Button icon="block" onClick={() => void disableAccount(session.profile_id, session.display_name)}>
              השבתת חשבון
            </Button>
          )}
        </div>
      )}
    </article>
  );
}

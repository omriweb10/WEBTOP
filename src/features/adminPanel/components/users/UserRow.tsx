import { Avatar } from '../../../../components/ui/Avatar';
import { Icon } from '../../../../components/ui/Icon';
import type { UserOverview } from '../../api/types';
import { formatRelative } from '../../domain/formatters';
import { Badge } from '../shared/Badge';
import { ConnectionBadge } from './ConnectionBadge';
import styles from './users.module.css';

/** One student in the list: picture, name, class, connection and code status. */
export function UserRow({ user, avatarUrl, onOpen }: { user: UserOverview; avatarUrl?: string; onOpen: () => void }) {
  return (
    <button type="button" className={styles.row} onClick={onOpen}>
      <Avatar name={user.display_name} src={avatarUrl} size={46} />
      <span className={styles.rowText}>
        <span className={styles.rowName}>{user.display_name}</span>
        <span className={styles.rowMeta}>
          {[user.class_name, user.school_name].filter(Boolean).join(' · ') || 'ללא כיתה'}
          {user.code_last_used_at && ` · כניסה אחרונה ${formatRelative(user.code_last_used_at)}`}
        </span>
        <span className={styles.badges}>
          {user.status === 'disabled' && <Badge tone="danger">מושבת</Badge>}
          <ConnectionBadge lastSeenAt={user.session_last_seen_at} hasSession={Boolean(user.session_id)} />
          {user.code_hint ? <Badge>קוד ‎…{user.code_hint}</Badge> : <Badge tone="warning">אין קוד</Badge>}
        </span>
      </span>
      <Icon name="chevronLeft" size={22} className={styles.chevron} />
    </button>
  );
}

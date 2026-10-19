import { useEffect, useState } from 'react';
import { navigate } from '../../../../app/router';
import { Avatar } from '../../../../components/ui/Avatar';
import { Icon } from '../../../../components/ui/Icon';
import { useAvatarUrls } from '../../state/avatarUrls';
import { useUsers } from '../../state/resources';
import { Badge } from '../shared/Badge';
import { Page } from '../shared/Page';
import { ErrorView, LoadingView } from '../shared/StatusViews';
import { AccessCodePanel } from './AccessCodePanel';
import { AvatarPanel } from './AvatarPanel';
import { ConnectionBadge } from './ConnectionBadge';
import { UserDetailsPanel } from './UserDetailsPanel';
import { UserPresetsPanel } from './UserPresetsPanel';
import { UserSessionPanel } from './UserSessionPanel';
import { UserTimetablePanel } from './UserTimetablePanel';
import styles from './users.module.css';

const TABS = [
  { id: 'details', label: 'פרטים' },
  { id: 'code', label: 'קוד גישה' },
  { id: 'session', label: 'חיבור' },
  { id: 'picture', label: 'תמונה' },
  { id: 'presets', label: 'מקצועות' },
  { id: 'timetable', label: 'מערכת שעות' },
] as const;
type Tab = (typeof TABS)[number]['id'];

/** Everything about one student, in tabs. */
export function UserDetail({ profileId }: { profileId: string }) {
  const { data: users, status, error, load } = useUsers();
  const [tab, setTab] = useState<Tab>('details');
  const user = users?.find((u) => u.id === profileId);
  const urls = useAvatarUrls([user?.avatar_path]);

  useEffect(() => {
    void load();
  }, [load]);

  const back = (
    <button type="button" className={styles.back} onClick={() => navigate({ name: 'admin', section: 'users' })}>
      <Icon name="arrowBack" size={20} />
      כל המשתמשים
    </button>
  );

  if (!user) {
    return (
      <Page title="משתמש" before={back}>
        {status === 'loading' || status === 'idle' ? (
          <LoadingView />
        ) : (
          <ErrorView message={error ?? 'המשתמש לא נמצא (ייתכן שנמחק).'} onRetry={() => void load(true)} />
        )}
      </Page>
    );
  }

  const avatarUrl = user.avatar_path ? urls[user.avatar_path] : undefined;

  return (
    <Page title={user.display_name} before={back}>
      <div className={styles.hero}>
        <Avatar name={user.display_name} src={avatarUrl} size={72} />
        <div className={styles.heroText}>
          <p className={styles.heroMeta}>{[user.class_name, user.school_name].filter(Boolean).join(' · ') || 'ללא כיתה'}</p>
          <div className={styles.badges}>
            {user.status === 'disabled' ? <Badge tone="danger">מושבת</Badge> : <Badge tone="success">פעיל</Badge>}
            <ConnectionBadge lastSeenAt={user.session_last_seen_at} hasSession={Boolean(user.session_id)} />
            {user.code_hint ? <Badge>קוד ‎…{user.code_hint}</Badge> : <Badge tone="warning">אין קוד</Badge>}
          </div>
        </div>
      </div>

      <div className={styles.tabs} role="tablist" aria-label="פרטי המשתמש">
        {TABS.map((item) => (
          <button
            key={item.id}
            type="button"
            role="tab"
            id={`user-tab-${item.id}`}
            aria-selected={tab === item.id}
            aria-controls="user-tab-panel"
            className={tab === item.id ? styles.tabOn : styles.tab}
            onClick={() => setTab(item.id)}
          >
            {item.label}
          </button>
        ))}
      </div>

      <div id="user-tab-panel" role="tabpanel" aria-labelledby={`user-tab-${tab}`}>
        {tab === 'details' && <UserDetailsPanel user={user} />}
        {tab === 'code' && <AccessCodePanel user={user} />}
        {tab === 'session' && <UserSessionPanel user={user} />}
        {tab === 'picture' && <AvatarPanel user={user} avatarUrl={avatarUrl} />}
        {tab === 'presets' && <UserPresetsPanel profileId={user.id} />}
        {tab === 'timetable' && <UserTimetablePanel user={user} />}
      </div>
    </Page>
  );
}

import { useEffect, useMemo, useState } from 'react';
import { Button } from '../../../../components/ui/Button';
import type { SessionOverview } from '../../api/types';
import { connectionState } from '../../domain/userFilters';
import { useAvatarUrls } from '../../state/avatarUrls';
import { useSessions } from '../../state/resources';
import { Page, Panel } from '../shared/Page';
import { FilterChips } from '../shared/SearchInput';
import { EmptyView, ErrorView, LoadingView } from '../shared/StatusViews';
import { SessionCard } from './SessionCard';
import styles from './sessions.module.css';

const AUTO_REFRESH_MS = 30_000;

type View = 'live' | 'ended';

/** Live dashboard of who is signed in where, with the controls to end it. */
export function SessionsSection() {
  const { data, status, error, load } = useSessions();
  const [view, setView] = useState<View>('live');

  useEffect(() => {
    void load(true);
    const timer = window.setInterval(() => {
      if (document.visibilityState === 'visible') void load(true);
    }, AUTO_REFRESH_MS);
    return () => window.clearInterval(timer);
  }, [load]);

  const live = useMemo(() => (data ?? []).filter((s) => s.status !== 'ended'), [data]);
  const ended = useMemo(() => (data ?? []).filter((s) => s.status === 'ended'), [data]);
  const activeNow = live.filter((s) => s.status === 'active' && connectionState(s.last_seen_at, true) === 'active-now').length;
  const shown: SessionOverview[] = view === 'live' ? live : ended;
  const urls = useAvatarUrls(shown.map((s) => s.avatar_path));

  return (
    <Page
      title="חיבורים"
      subtitle="מתעדכן אוטומטית כל 30 שניות"
      actions={
        <Button icon="sync" onClick={() => void load(true)}>
          רענון
        </Button>
      }
    >
      <div className={styles.stats}>
        <Panel>
          <p className={styles.statValue}>{live.filter((s) => s.status === 'active').length}</p>
          <p className={styles.statLabel}>מחוברים</p>
        </Panel>
        <Panel>
          <p className={styles.statValue}>{activeNow}</p>
          <p className={styles.statLabel}>פעילים כעת</p>
        </Panel>
      </div>
      <FilterChips
        label="תצוגה"
        value={view}
        onChange={setView}
        options={[
          { value: 'live', label: 'חיבורים פעילים', count: live.length },
          { value: 'ended', label: 'הסתיימו לאחרונה', count: ended.length },
        ]}
      />
      {status === 'loading' && <LoadingView />}
      {status === 'error' && error && <ErrorView message={error} onRetry={() => void load(true)} />}
      {data && shown.length === 0 && <EmptyView text={view === 'live' ? 'אף אחד אינו מחובר כרגע.' : 'אין חיבורים שהסתיימו לאחרונה.'} />}
      <ul className={styles.list}>
        {shown.map((session) => (
          <li key={session.id}>
            <SessionCard session={session} avatarUrl={session.avatar_path ? urls[session.avatar_path] : undefined} />
          </li>
        ))}
      </ul>
    </Page>
  );
}

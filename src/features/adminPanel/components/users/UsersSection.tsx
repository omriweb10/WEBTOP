import { useEffect, useMemo, useState } from 'react';
import { navigate } from '../../../../app/router';
import { Button } from '../../../../components/ui/Button';
import { Modal } from '../../../../components/ui/Modal';
import { toast } from '../../../../store/uiStore';
import { createUser } from '../../api/usersApi';
import { errorMessage } from '../../domain/adminErrors';
import { EMPTY_PROFILE } from '../../domain/profileForm';
import { filterUsers, userCounts, type UserFilter } from '../../domain/userFilters';
import { useAvatarUrls } from '../../state/avatarUrls';
import { useUsers } from '../../state/resources';
import { Page } from '../shared/Page';
import { FilterChips, SearchInput } from '../shared/SearchInput';
import { EmptyView, ErrorView, LoadingView } from '../shared/StatusViews';
import { UserForm } from './UserForm';
import { UserRow } from './UserRow';
import styles from './users.module.css';

/** Searchable list of students with a "new student" form. */
export function UsersSection() {
  const { data: users, status, error, load } = useUsers();
  const [query, setQuery] = useState('');
  const [filter, setFilter] = useState<UserFilter>('all');
  const [creating, setCreating] = useState(false);

  useEffect(() => {
    void load();
  }, [load]);

  const shown = useMemo(() => filterUsers(users ?? [], query, filter), [users, query, filter]);
  const counts = useMemo(() => userCounts(users ?? []), [users]);
  const urls = useAvatarUrls(shown.map((u) => u.avatar_path));

  return (
    <Page
      title="משתמשים"
      subtitle={users ? `${counts.all} משתמשים · ${counts.connected} מחוברים` : undefined}
      actions={
        <>
          <Button icon="sync" onClick={() => void load(true)} aria-label="רענון">
            רענון
          </Button>
          <Button icon="personAdd" variant="primary" onClick={() => setCreating(true)}>
            משתמש חדש
          </Button>
        </>
      }
    >
      <div className={styles.toolbar}>
        <SearchInput value={query} onChange={setQuery} label="חיפוש משתמשים" placeholder="חיפוש לפי שם, כיתה או בית ספר" />
        <FilterChips
          label="סינון"
          value={filter}
          onChange={setFilter}
          options={[
            { value: 'all', label: 'הכול', count: counts.all },
            { value: 'connected', label: 'מחוברים', count: counts.connected },
            { value: 'no-code', label: 'ללא קוד', count: counts['no-code'] },
            { value: 'disabled', label: 'מושבתים', count: counts.disabled },
          ]}
        />
      </div>

      {status === 'loading' && <LoadingView />}
      {status === 'error' && error && <ErrorView message={error} onRetry={() => void load(true)} />}
      {users && shown.length === 0 && (
        <EmptyView text={users.length === 0 ? 'עדיין אין משתמשים. צרו את הראשון בכפתור „משתמש חדש”.' : 'אין משתמשים שתואמים לחיפוש.'} />
      )}
      {shown.length > 0 && (
        <ul className={styles.list}>
          {shown.map((user) => (
            <li key={user.id}>
              <UserRow
                user={user}
                avatarUrl={user.avatar_path ? urls[user.avatar_path] : undefined}
                onOpen={() => navigate({ name: 'admin', section: 'users', id: user.id })}
              />
            </li>
          ))}
        </ul>
      )}

      <Modal open={creating} title="משתמש חדש" onClose={() => setCreating(false)}>
        {creating && (
          <UserForm
            initial={EMPTY_PROFILE}
            submitLabel="יצירה"
            onCancel={() => setCreating(false)}
            onSubmit={async (fields) => {
              try {
                const id = await createUser(fields);
                void load(true);
                setCreating(false);
                toast('המשתמש נוצר. עכשיו אפשר להנפיק לו קוד גישה.', { tone: 'success' });
                navigate({ name: 'admin', section: 'users', id });
                return null;
              } catch (failure) {
                return errorMessage(failure);
              }
            }}
          />
        )}
      </Modal>
    </Page>
  );
}

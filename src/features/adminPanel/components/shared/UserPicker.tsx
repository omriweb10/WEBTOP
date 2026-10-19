import { useMemo, useState } from 'react';
import { Avatar } from '../../../../components/ui/Avatar';
import type { UserOverview } from '../../api/types';
import { filterUsers } from '../../domain/userFilters';
import { useAvatarUrls } from '../../state/avatarUrls';
import { SearchInput } from './SearchInput';
import styles from './UserPicker.module.css';

interface UserPickerProps {
  users: readonly UserOverview[];
  selected: ReadonlySet<string>;
  onChange: (next: Set<string>) => void;
}

/** Searchable checklist of students with "select all shown" / "clear". */
export function UserPicker({ users, selected, onChange }: UserPickerProps) {
  const [query, setQuery] = useState('');
  const shown = useMemo(() => filterUsers(users, query, 'all'), [users, query]);
  const urls = useAvatarUrls(shown.map((u) => u.avatar_path));

  /** Flips one student. */
  const toggle = (id: string) => {
    const next = new Set(selected);
    if (next.has(id)) next.delete(id);
    else next.add(id);
    onChange(next);
  };

  return (
    <div>
      <SearchInput value={query} onChange={setQuery} label="חיפוש משתמשים" placeholder="שם, כיתה או בית ספר" />
      <div className={styles.toolbar}>
        <span>{selected.size} נבחרו</span>
        <button type="button" className={styles.link} onClick={() => onChange(new Set([...selected, ...shown.map((u) => u.id)]))}>
          בחירת כל המוצגים
        </button>
        <button type="button" className={styles.link} onClick={() => onChange(new Set())} disabled={selected.size === 0}>
          ניקוי
        </button>
      </div>
      <ul className={styles.list}>
        {shown.map((user) => (
          <li key={user.id}>
            <label className={styles.row}>
              <input type="checkbox" checked={selected.has(user.id)} onChange={() => toggle(user.id)} />
              <Avatar name={user.display_name} src={user.avatar_path ? urls[user.avatar_path] : null} size={30} />
              <span className={styles.name}>{user.display_name}</span>
              <span className={styles.meta}>{user.class_name}</span>
            </label>
          </li>
        ))}
        {shown.length === 0 && <li className={styles.none}>אין משתמשים תואמים.</li>}
      </ul>
    </div>
  );
}

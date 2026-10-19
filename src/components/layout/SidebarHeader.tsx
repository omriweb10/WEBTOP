import { useState } from 'react';
import { useAccountStore } from '../../features/account/accountStore';
import type { Profile } from '../../schemas/content';
import { localStore } from '../../services/storage/appStorage';
import { LAST_OPENED_KEY } from '../../services/storage/slices';
import { formatDmy } from '../../utils/dates';
import { Avatar } from '../ui/Avatar';
import { Icon } from '../ui/Icon';
import styles from './Sidebar.module.css';

/** "DD/MM/YYYY (HH:MM)" for the previous app launch, or null if unknown. */
function previousLaunchLabel(): string | null {
  const iso = localStore.get(`${LAST_OPENED_KEY}:previous`);
  if (!iso) return null;
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return null;
  const time = date.toLocaleTimeString('he-IL', { hour: '2-digit', minute: '2-digit', hour12: false });
  return `${formatDmy(date)} (${time})`;
}

/** Drawer header: unofficial brand line, profile picture, display name and previous launch time. */
export function SidebarHeader({ profile }: { profile: Profile }) {
  const [lastLaunch] = useState(previousLaunchLabel);
  const avatarUrl = useAccountStore((state) => state.avatarUrl);
  const name = profile.studentName.trim() || 'תלמיד/ה';
  return (
    <div className={styles.header}>
      <svg className={styles.waves} viewBox="0 0 320 110" preserveAspectRatio="none" aria-hidden="true">
        <path d="M0 70 C 70 40, 140 100, 220 60 S 320 30, 320 30" fill="none" stroke="#2a4a72" strokeWidth="1.2" />
        <path d="M0 88 C 90 60, 160 112, 240 78 S 320 52, 320 52" fill="none" stroke="#24426a" strokeWidth="1" />
        <path d="M0 102 C 80 84, 170 120, 250 96 S 320 76, 320 76" fill="none" stroke="#1f3a5e" strokeWidth="1" />
      </svg>
      <div className={styles.brand}>
        <Icon name="school" size={22} />
        <span className={styles.brandName}>WEBTOP</span>
        <span className={styles.unofficial}>לא רשמי</span>
      </div>
      <div className={styles.identity}>
        <Avatar name={name} src={avatarUrl} size={40} />
        <div className={styles.identityText}>
          <span className={styles.name}>{name}</span>
          {lastLaunch && <span className={styles.lastLogin}>פתיחה קודמת: {lastLaunch}</span>}
        </div>
      </div>
    </div>
  );
}

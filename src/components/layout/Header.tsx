import type { ReactNode } from 'react';
import { useUiStore } from '../../store/uiStore';
import { IconButton } from '../ui/IconButton';
import styles from './Header.module.css';

interface HeaderProps {
  title: string;
  /** Icon buttons rendered at the far (left) side; first item is closest to the title. */
  actions?: ReactNode;
  /** Optional tap handler on the title (used for the hidden edit-mode gesture). */
  onTitleTap?: () => void;
}

/** App bar: menu button, screen title and per-screen actions. */
export function Header({ title, actions, onTitleTap }: HeaderProps) {
  const openSidebar = useUiStore((state) => state.setSidebarOpen);
  return (
    <header className={styles.appbar}>
      <IconButton
        icon="menu"
        label="פתיחת תפריט"
        className={styles.menuButton}
        onClick={() => openSidebar(true)}
        aria-haspopup="dialog"
      />
      <h1 className={styles.title} onClick={onTitleTap}>
        {title}
      </h1>
      {actions && <div className={styles.actions}>{actions}</div>}
    </header>
  );
}

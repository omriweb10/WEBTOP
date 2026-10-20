import type { ReactNode } from 'react';
import { useUiStore } from '../../store/uiStore';
import { IconButton } from '../ui/IconButton';
import styles from './Header.module.css';

/** Back arrow shown instead of the menu button on screens inside a section. */
export interface HeaderBack {
  /** Accessible name, e.g. "חזרה לכרטיס תלמיד". */
  label: string;
  onBack: () => void;
}

interface HeaderProps {
  title: string;
  /** Replaces the menu button with a back arrow at the far (right) side. */
  back?: HeaderBack;
  /** Icon buttons rendered at the far (left) side; first item is closest to the title. */
  actions?: ReactNode;
  /** Optional tap handler on the title (used for the hidden edit-mode gesture). */
  onTitleTap?: () => void;
}

/** App bar: menu button (or a back arrow), screen title and per-screen actions. */
export function Header({ title, back, actions, onTitleTap }: HeaderProps) {
  const openSidebar = useUiStore((state) => state.setSidebarOpen);
  return (
    <header className={styles.appbar}>
      {back ? (
        <IconButton icon="arrowBack" label={back.label} className={styles.leadingButton} onClick={back.onBack} />
      ) : (
        <IconButton
          icon="menu"
          label="פתיחת תפריט"
          className={styles.leadingButton}
          onClick={() => openSidebar(true)}
          aria-haspopup="dialog"
        />
      )}
      <h1 className={styles.title} onClick={onTitleTap}>
        {title}
      </h1>
      {actions && <div className={styles.actions}>{actions}</div>}
    </header>
  );
}

import type { ReactNode } from 'react';
import { EditModeBar } from '../../features/admin/components/EditModeBar';
import { useIsEditing } from '../../features/admin/editModeStore';
import { Header } from './Header';
import styles from './ScreenFrame.module.css';

interface ScreenFrameProps {
  title: string;
  actions?: ReactNode;
  onTitleTap?: () => void;
  children: ReactNode;
}

/**
 * Standard screen layout: app bar, the edit-mode strip (only while editing) and a
 * content region that fills the remaining height. Content owns its own scrolling.
 */
export function ScreenFrame({ title, actions, onTitleTap, children }: ScreenFrameProps) {
  const editing = useIsEditing();
  return (
    <div className={styles.frame}>
      <Header title={title} actions={actions} onTitleTap={onTitleTap} />
      {editing && <EditModeBar />}
      <main className={styles.content}>{children}</main>
    </div>
  );
}

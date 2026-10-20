import type { ReactNode } from 'react';
import { accountMode } from '../../config/backend';
import { OfflineStrip } from '../../features/account/components/OfflineStrip';
import { EditModeBar } from '../../features/admin/components/EditModeBar';
import { useIsEditing } from '../../features/admin/editModeStore';
import { Header, type HeaderBack } from './Header';
import styles from './ScreenFrame.module.css';

interface ScreenFrameProps {
  title: string;
  back?: HeaderBack;
  actions?: ReactNode;
  onTitleTap?: () => void;
  children: ReactNode;
}

/**
 * Standard screen layout: app bar, the edit-mode strip (only while editing), the offline
 * strip (account mode) and a content region that fills the remaining height.
 */
export function ScreenFrame({ title, back, actions, onTitleTap, children }: ScreenFrameProps) {
  const editing = useIsEditing();
  return (
    <div className={styles.frame}>
      <Header title={title} back={back} actions={actions} onTitleTap={onTitleTap} />
      {accountMode && <OfflineStrip />}
      {editing && <EditModeBar />}
      <main className={styles.content}>{children}</main>
    </div>
  );
}

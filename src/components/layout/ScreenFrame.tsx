import type { ReactNode } from 'react';
import { accountMode } from '../../config/backend';
import { AccountHeaderButton } from '../../features/account/components/AccountHeaderButton';
import { OfflineStrip } from '../../features/account/components/OfflineStrip';
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
 * Standard screen layout: app bar, the edit-mode strip (only while editing), the offline
 * strip (account mode) and a content region that fills the remaining height.
 */
export function ScreenFrame({ title, actions, onTitleTap, children }: ScreenFrameProps) {
  const editing = useIsEditing();
  return (
    <div className={styles.frame}>
      <Header
        title={title}
        actions={
          accountMode ? (
            <>
              {actions}
              <AccountHeaderButton />
            </>
          ) : (
            actions
          )
        }
        onTitleTap={onTitleTap}
      />
      {accountMode && <OfflineStrip />}
      {editing && <EditModeBar />}
      <main className={styles.content}>{children}</main>
    </div>
  );
}

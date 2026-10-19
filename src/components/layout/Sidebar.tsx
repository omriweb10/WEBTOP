import { useEffect, useRef } from 'react';
import { NAV_ITEMS } from '../../app/navigation';
import { navigate, useRoute } from '../../app/router';
import { useNoticesStore, useProfileStore } from '../../store/dataStores';
import { useUiStore } from '../../store/uiStore';
import { cx } from '../../utils/classNames';
import { Icon } from '../ui/Icon';
import { SidebarHeader } from './SidebarHeader';
import styles from './Sidebar.module.css';

const CLOSE_ANIMATION_MS = 200;
const CLOSING_CLASS = styles.closing ?? 'sidebar-closing';

/**
 * Navigation drawer sliding in from the right (RTL start edge). Implemented with a
 * modal <dialog> so focus is trapped, Escape closes it and the page behind is inert.
 */
export function Sidebar() {
  const open = useUiStore((state) => state.sidebarOpen);
  const setOpen = useUiStore((state) => state.setSidebarOpen);
  const route = useRoute();
  const profile = useProfileStore((state) => state.value);
  const noticeCount = useNoticesStore((state) => state.value.length);
  const ref = useRef<HTMLDialogElement>(null);

  // Drive the native dialog from the store. Closing plays the slide-out animation first
  // (a DOM class toggle — the dialog is an external system from React's point of view).
  useEffect(() => {
    const dialog = ref.current;
    if (!dialog) return undefined;
    if (open) {
      dialog.classList.remove(CLOSING_CLASS);
      if (!dialog.open) dialog.showModal?.();
      return undefined;
    }
    if (!dialog.open) return undefined;
    dialog.classList.add(CLOSING_CLASS);
    const timer = window.setTimeout(() => {
      dialog.close?.();
      dialog.classList.remove(CLOSING_CLASS);
    }, CLOSE_ANIMATION_MS);
    return () => window.clearTimeout(timer);
  }, [open]);

  return (
    <dialog
      ref={ref}
      className={styles.drawer}
      aria-label="תפריט ראשי"
      onCancel={(event) => {
        event.preventDefault();
        setOpen(false);
      }}
      onClick={(event) => {
        if (event.target === event.currentTarget) setOpen(false);
      }}
    >
      <div className={styles.panel}>
        <SidebarHeader profile={profile} />
        <p className={styles.subtitle}>{profile.subtitle}</p>
        <nav aria-label="ניווט">
          <ul className={styles.list}>
            {NAV_ITEMS.map((item) => {
              const active = item.matches(route);
              const badge = item.id === 'notifications' ? noticeCount : 0;
              return (
                <li key={item.id}>
                  <button
                    type="button"
                    className={cx(styles.item, active && styles.active)}
                    aria-current={active ? 'page' : undefined}
                    onClick={() => {
                      setOpen(false);
                      navigate(item.route);
                    }}
                  >
                    <Icon name={item.icon} size={20} className={styles.icon} />
                    <span className={styles.label}>{item.label}</span>
                    {badge > 0 && (
                      <span className={styles.badge} aria-label={`${badge} הודעות`}>
                        {badge}
                      </span>
                    )}
                  </button>
                </li>
              );
            })}
          </ul>
        </nav>
      </div>
    </dialog>
  );
}

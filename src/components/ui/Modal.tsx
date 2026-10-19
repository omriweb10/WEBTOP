import { useEffect, useId, useRef, type ReactNode } from 'react';
import { cx } from '../../utils/classNames';
import { IconButton } from './IconButton';
import styles from './Modal.module.css';

interface ModalProps {
  open: boolean;
  title: string;
  onClose: () => void;
  children: ReactNode;
  /** Sticky action row at the bottom of the dialog. */
  footer?: ReactNode;
  /** 'sheet' slides up from the bottom (editors); 'dialog' is centred (confirmations). */
  variant?: 'sheet' | 'dialog';
  /** Optional element (by id) to focus first instead of the close button. */
  initialFocusId?: string;
  className?: string;
}

/**
 * Accessible modal built on the native <dialog> element: the browser provides focus
 * trapping, Escape-to-close and an inert background (iOS Safari 15.4+).
 */
export function Modal({ open, title, onClose, children, footer, variant = 'sheet', initialFocusId, className }: ModalProps) {
  const ref = useRef<HTMLDialogElement>(null);
  const titleId = useId();

  useEffect(() => {
    const dialog = ref.current;
    if (!dialog) return;
    if (open && !dialog.open) {
      if (typeof dialog.showModal === 'function') dialog.showModal();
      else dialog.setAttribute('open', '');
      if (initialFocusId) document.getElementById(initialFocusId)?.focus();
    } else if (!open && dialog.open) {
      if (typeof dialog.close === 'function') dialog.close();
      else dialog.removeAttribute('open');
    }
  }, [open, initialFocusId]);

  return (
    <dialog
      ref={ref}
      className={cx(styles.dialog, variant === 'sheet' ? styles.sheet : styles.center, className)}
      aria-labelledby={titleId}
      onCancel={(event) => {
        event.preventDefault();
        onClose();
      }}
      onClick={(event) => {
        // A click on the ::backdrop is reported on the dialog element itself.
        if (event.target === event.currentTarget) onClose();
      }}
    >
      {open && (
        <div className={styles.panel}>
          <header className={styles.header}>
            <h2 id={titleId} className={styles.title}>
              {title}
            </h2>
            <IconButton icon="close" label="סגירה" onClick={onClose} />
          </header>
          <div className={styles.body}>{children}</div>
          {footer && <footer className={styles.footer}>{footer}</footer>}
        </div>
      )}
    </dialog>
  );
}

import { useEffect } from 'react';
import { useUiStore, type Toast } from '../../store/uiStore';
import { cx } from '../../utils/classNames';
import styles from './ToastHost.module.css';

/** One toast; schedules its own dismissal. */
function ToastItem({ toast }: { toast: Toast }) {
  const dismiss = useUiStore((state) => state.dismissToast);

  useEffect(() => {
    if (toast.duration <= 0) return undefined;
    const timer = window.setTimeout(() => dismiss(toast.id), toast.duration);
    return () => window.clearTimeout(timer);
  }, [toast.id, toast.duration, dismiss]);

  return (
    <div className={cx(styles.toast, styles[toast.tone])} role={toast.tone === 'error' ? 'alert' : 'status'}>
      <span className={styles.message}>{toast.message}</span>
      {toast.action && (
        <button
          type="button"
          className={styles.action}
          onClick={() => {
            toast.action?.run();
            dismiss(toast.id);
          }}
        >
          {toast.action.label}
        </button>
      )}
      <button type="button" className={styles.close} aria-label="סגירת הודעה" onClick={() => dismiss(toast.id)}>
        ×
      </button>
    </div>
  );
}

/** Stack of transient messages above the home indicator. */
export function ToastHost() {
  const toasts = useUiStore((state) => state.toasts);
  return (
    <div className={styles.host} aria-live="polite">
      {toasts.map((toast) => (
        <ToastItem key={toast.id} toast={toast} />
      ))}
    </div>
  );
}

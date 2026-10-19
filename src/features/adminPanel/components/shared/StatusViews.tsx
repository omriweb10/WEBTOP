import { Button } from '../../../../components/ui/Button';
import { Icon } from '../../../../components/ui/Icon';
import styles from './StatusViews.module.css';

/** Placeholder while a list loads. */
export function LoadingView({ label = 'טוען…' }: { label?: string }) {
  return (
    <div className={styles.box} role="status" aria-live="polite">
      <span className={styles.spinner} aria-hidden="true" />
      <span>{label}</span>
    </div>
  );
}

/** Failure with a retry button. */
export function ErrorView({ message, onRetry }: { message: string; onRetry?: () => void }) {
  return (
    <div className={styles.error} role="alert">
      <Icon name="warning" size={22} />
      <p className={styles.text}>{message}</p>
      {onRetry && (
        <Button icon="sync" onClick={onRetry}>
          ניסיון חוזר
        </Button>
      )}
    </div>
  );
}

/** Empty list explanation. */
export function EmptyView({ text }: { text: string }) {
  return <p className={styles.empty}>{text}</p>;
}

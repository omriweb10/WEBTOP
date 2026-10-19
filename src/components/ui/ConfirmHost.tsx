import { Button } from './Button';
import { useConfirmStore } from './confirmStore';
import { Modal } from './Modal';
import styles from './ConfirmHost.module.css';

/** Renders the single app-wide confirmation dialog driven by `confirm()`. */
export function ConfirmHost() {
  const request = useConfirmStore((state) => state.request);
  const settle = useConfirmStore((state) => state.settle);

  return (
    <Modal
      open={request !== null}
      variant="dialog"
      title={request?.title ?? ''}
      onClose={() => settle(false)}
      footer={
        <>
          <Button variant={request?.tone === 'danger' ? 'danger' : 'primary'} onClick={() => settle(true)}>
            {request?.confirmLabel ?? 'אישור'}
          </Button>
          <Button variant="secondary" onClick={() => settle(false)}>
            {request?.cancelLabel ?? 'ביטול'}
          </Button>
        </>
      }
    >
      <p className={styles.message}>{request?.message}</p>
    </Modal>
  );
}

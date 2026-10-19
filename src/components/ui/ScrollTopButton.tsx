import { cx } from '../../utils/classNames';
import { Icon } from './Icon';
import styles from './ScrollTopButton.module.css';

interface ScrollTopButtonProps {
  visible: boolean;
  onClick: () => void;
}

/** White floating "back to top" button shown after scrolling (bottom-right, as in the reference). */
export function ScrollTopButton({ visible, onClick }: ScrollTopButtonProps) {
  return (
    <button
      type="button"
      className={cx(styles.fab, visible && styles.visible)}
      onClick={onClick}
      aria-label="חזרה לראש העמוד"
      aria-hidden={!visible}
      tabIndex={visible ? 0 : -1}
    >
      <Icon name="arrowUp" size={24} />
    </button>
  );
}

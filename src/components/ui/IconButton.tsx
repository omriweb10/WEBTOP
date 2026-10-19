import type { ButtonHTMLAttributes } from 'react';
import { cx } from '../../utils/classNames';
import { Icon } from './Icon';
import type { IconName } from './icons/iconPaths';
import styles from './IconButton.module.css';

interface IconButtonProps extends Omit<ButtonHTMLAttributes<HTMLButtonElement>, 'children'> {
  icon: IconName;
  /** Required accessible name (also used as tooltip). */
  label: string;
  iconSize?: number;
  badge?: number;
}

/** Square, 44pt touch-target button showing a single icon and an optional count badge. */
export function IconButton({ icon, label, iconSize = 24, badge, className, type = 'button', ...rest }: IconButtonProps) {
  return (
    <button type={type} className={cx(styles.button, className)} aria-label={label} title={label} {...rest}>
      <Icon name={icon} size={iconSize} />
      {badge !== undefined && badge > 0 && (
        <span className={styles.badge} aria-hidden="true">
          {badge > 99 ? '99+' : badge}
        </span>
      )}
    </button>
  );
}

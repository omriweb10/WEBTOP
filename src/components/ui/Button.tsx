import type { ButtonHTMLAttributes, ReactNode } from 'react';
import { cx } from '../../utils/classNames';
import { Icon } from './Icon';
import type { IconName } from './icons/iconPaths';
import styles from './Button.module.css';

type Variant = 'primary' | 'secondary' | 'ghost' | 'danger';

interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: Variant;
  icon?: IconName;
  block?: boolean;
  children: ReactNode;
}

/** Text button used in dialogs, the editor and admin tools (never in the read-only view). */
export function Button({ variant = 'secondary', icon, block, className, type = 'button', children, ...rest }: ButtonProps) {
  return (
    <button type={type} className={cx(styles.button, styles[variant], block && styles.block, className)} {...rest}>
      {icon && <Icon name={icon} size={20} />}
      <span>{children}</span>
    </button>
  );
}

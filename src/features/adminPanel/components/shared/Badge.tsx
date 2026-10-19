import type { ReactNode } from 'react';
import { cx } from '../../../../utils/classNames';
import styles from './Badge.module.css';

export type BadgeTone = 'neutral' | 'success' | 'info' | 'warning' | 'danger';

/** Small status pill; `dot` adds a leading coloured dot (e.g. "connected"). */
export function Badge({ tone = 'neutral', dot, children }: { tone?: BadgeTone; dot?: boolean; children: ReactNode }) {
  return (
    <span className={cx(styles.badge, styles[tone])}>
      {dot && <span className={styles.dot} aria-hidden="true" />}
      {children}
    </span>
  );
}

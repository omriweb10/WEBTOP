import { useState } from 'react';
import { cx } from '../../utils/classNames';
import { initialsOf } from '../../utils/initials';
import styles from './Avatar.module.css';

interface AvatarProps {
  name: string;
  /** Picture URL; initials are shown when absent or when it fails to load. */
  src?: string | null;
  size?: number;
  shape?: 'circle' | 'square';
  className?: string;
}

/** Profile picture with an initials fallback (decorative: the name is always shown nearby). */
export function Avatar({ name, src, size = 40, shape = 'circle', className }: AvatarProps) {
  const [failedSrc, setFailedSrc] = useState<string | null>(null);
  const showImage = Boolean(src) && failedSrc !== src;
  return (
    <span
      className={cx(styles.avatar, shape === 'square' && styles.square, className)}
      style={{ width: size, height: size, fontSize: Math.round(size * 0.4) }}
      aria-hidden="true"
    >
      {showImage ? (
        <img className={styles.image} src={src ?? undefined} alt="" draggable={false} onError={() => setFailedSrc(src ?? null)} />
      ) : (
        initialsOf(name)
      )}
    </span>
  );
}

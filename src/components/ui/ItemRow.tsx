import type { ReactNode } from 'react';
import { IconButton } from './IconButton';
import styles from './ItemRow.module.css';

interface ItemRowProps {
  title: string;
  meta?: ReactNode;
  body?: string;
  accent?: string;
  /** Edit-mode controls; omitted in normal viewing. */
  onEdit?: () => void;
  onDelete?: () => void;
}

/** One notice / event line: title, meta line (date, type), optional body and edit controls. */
export function ItemRow({ title, meta, body, accent, onEdit, onDelete }: ItemRowProps) {
  return (
    <article className={styles.row} style={accent ? { borderInlineStartColor: accent } : undefined}>
      <div className={styles.text}>
        <h3 className={styles.title}>{title}</h3>
        {meta && <p className={styles.meta}>{meta}</p>}
        {body && (
          <p className={styles.body} data-selectable>
            {body}
          </p>
        )}
      </div>
      {(onEdit || onDelete) && (
        <div className={styles.controls}>
          {onEdit && <IconButton icon="edit" label={`עריכת ${title}`} iconSize={20} onClick={onEdit} />}
          {onDelete && <IconButton icon="delete" label={`מחיקת ${title}`} iconSize={20} onClick={onDelete} />}
        </div>
      )}
    </article>
  );
}

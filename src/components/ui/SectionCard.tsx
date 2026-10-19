import type { ReactNode } from 'react';
import styles from './SectionCard.module.css';

interface SectionCardProps {
  title: string;
  /** Optional control at the far end of the header (e.g. "+ הוספה" in edit mode). */
  action?: ReactNode;
  children: ReactNode;
  id?: string;
}

/** Titled block used on the notices tab and the home screen (header row + divider + body). */
export function SectionCard({ title, action, children, id }: SectionCardProps) {
  const headingId = id ? `${id}-title` : undefined;
  return (
    <section className={styles.card} aria-labelledby={headingId}>
      <header className={styles.header}>
        <h2 id={headingId} className={styles.title}>
          {title}
        </h2>
        {action}
      </header>
      <div className={styles.body}>{children}</div>
    </section>
  );
}

/** Standard empty-state line ("לא נמצאו נתונים במערכת."). */
export function EmptyState({ text = 'לא נמצאו נתונים במערכת.' }: { text?: string }) {
  return <p className={styles.empty}>{text}</p>;
}

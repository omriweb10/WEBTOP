import type { ReactNode } from 'react';
import styles from './Page.module.css';

interface PageProps {
  title: string;
  subtitle?: string;
  actions?: ReactNode;
  /** Optional element above the title (e.g. a back link). */
  before?: ReactNode;
  children: ReactNode;
}

/** One admin section: heading row with actions, then scrollable content. */
export function Page({ title, subtitle, actions, before, children }: PageProps) {
  return (
    <div className={styles.page}>
      <div className={styles.inner}>
        {before}
        <header className={styles.header}>
          <div className={styles.headings}>
            <h1 className={styles.title}>{title}</h1>
            {subtitle && <p className={styles.subtitle}>{subtitle}</p>}
          </div>
          {actions && <div className={styles.actions}>{actions}</div>}
        </header>
        {children}
      </div>
    </div>
  );
}

interface PanelProps {
  title?: string;
  actions?: ReactNode;
  children: ReactNode;
  id?: string;
}

/** A card inside a page. */
export function Panel({ title, actions, children, id }: PanelProps) {
  return (
    <section className={styles.panel} aria-labelledby={title && id ? `${id}-title` : undefined}>
      {(title || actions) && (
        <header className={styles.panelHeader}>
          {title && (
            <h2 id={id ? `${id}-title` : undefined} className={styles.panelTitle}>
              {title}
            </h2>
          )}
          {actions && <div className={styles.actions}>{actions}</div>}
        </header>
      )}
      <div className={styles.panelBody}>{children}</div>
    </section>
  );
}

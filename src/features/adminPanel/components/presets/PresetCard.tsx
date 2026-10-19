import type { ReactNode } from 'react';
import type { PresetRow } from '../../api/types';
import { presetDetails } from '../../domain/formatters';
import styles from './presets.module.css';

interface PresetCardProps {
  preset: PresetRow;
  /** Heading level of the name inside its page. */
  heading?: 'h2' | 'h3';
  /** Status pills under the details (usage, hidden, …). */
  badges?: ReactNode;
  /** Action buttons. */
  children: ReactNode;
}

/** One subject in a list: its colour, name, teacher and room, status pills and actions. */
export function PresetCard({ preset, heading: Heading = 'h2', badges, children }: PresetCardProps) {
  return (
    <li className={styles.card} style={{ borderInlineStartColor: preset.color }}>
      <div className={styles.cardText}>
        <div className={styles.titleRow}>
          <span className={styles.swatch} style={{ backgroundColor: preset.color }} aria-hidden="true" />
          <Heading className={styles.name}>{preset.name}</Heading>
        </div>
        {preset.short_name && <p className={styles.meta}>בתפריט: {preset.short_name}</p>}
        <p className={styles.meta}>{presetDetails(preset)}</p>
        {preset.notes && <p className={styles.notes}>{preset.notes}</p>}
        {badges && <div className={styles.badges}>{badges}</div>}
      </div>
      <div className={styles.cardActions}>{children}</div>
    </li>
  );
}

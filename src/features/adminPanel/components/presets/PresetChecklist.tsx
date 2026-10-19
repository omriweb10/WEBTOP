import type { PresetRow } from '../../api/types';
import { presetDetails } from '../../domain/formatters';
import styles from './presets.module.css';

export interface ChecklistItem {
  preset: PresetRow;
  /** Extra line under the details, e.g. that the target already has this subject. */
  hint?: string;
}

interface PresetChecklistProps {
  items: readonly ChecklistItem[];
  selected: ReadonlySet<string>;
  onChange: (next: Set<string>) => void;
}

/** Multi-select list of subjects with their colours, plus "select all" and "clear". */
export function PresetChecklist({ items, selected, onChange }: PresetChecklistProps) {
  /** Flips one subject. */
  const toggle = (id: string) => {
    const next = new Set(selected);
    if (next.has(id)) next.delete(id);
    else next.add(id);
    onChange(next);
  };

  return (
    <div>
      <div className={styles.checkTools}>
        <span>
          {selected.size} מתוך {items.length} נבחרו
        </span>
        <button type="button" className={styles.link} onClick={() => onChange(new Set(items.map((item) => item.preset.id)))}>
          בחירת הכול
        </button>
        <button type="button" className={styles.link} disabled={selected.size === 0} onClick={() => onChange(new Set())}>
          ניקוי
        </button>
      </div>
      <ul className={styles.checkList}>
        {items.map(({ preset, hint }) => (
          <li key={preset.id}>
            <label className={styles.check}>
              <input type="checkbox" checked={selected.has(preset.id)} onChange={() => toggle(preset.id)} />
              <span className={styles.swatch} style={{ backgroundColor: preset.color }} aria-hidden="true" />
              <span className={styles.checkText}>
                <span className={styles.checkName}>{preset.name}</span>
                <span className={styles.checkMeta}>{presetDetails(preset, '—')}</span>
                {hint && <span className={styles.checkHint}>{hint}</span>}
              </span>
            </label>
          </li>
        ))}
      </ul>
    </div>
  );
}

import type { Preset } from '../../../schemas/presets';
import { cx } from '../../../utils/classNames';
import styles from './PresetPicker.module.css';

/** Sentinel value for the "empty period" chip. */
export const EMPTY_PRESET = '__empty__';

interface PresetPickerProps {
  presets: readonly Preset[];
  /** Selected preset id, EMPTY_PRESET, or null for a custom lesson. */
  selected: string | null;
  onSelectPreset: (preset: Preset) => void;
  onSelectEmpty: () => void;
}

/** Chip list: "שעה ריקה" plus every subject preset. One tap fills all lesson fields. */
export function PresetPicker({ presets, selected, onSelectPreset, onSelectEmpty }: PresetPickerProps) {
  return (
    <div className={styles.chips} role="radiogroup" aria-label="תבנית מקצוע">
      <button
        type="button"
        role="radio"
        aria-checked={selected === EMPTY_PRESET}
        className={cx(styles.chip, styles.empty, selected === EMPTY_PRESET && styles.selected)}
        onClick={onSelectEmpty}
      >
        שעה ריקה
      </button>
      {presets.map((preset) => (
        <button
          key={preset.id}
          type="button"
          role="radio"
          aria-checked={selected === preset.id}
          className={cx(styles.chip, selected === preset.id && styles.selected)}
          onClick={() => onSelectPreset(preset)}
        >
          <span className={styles.dot} style={{ backgroundColor: preset.color }} aria-hidden="true" />
          {preset.name}
        </button>
      ))}
    </div>
  );
}

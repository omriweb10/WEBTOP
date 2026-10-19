import { useId } from 'react';
import { cx } from '../../utils/classNames';
import styles from './ColorPicker.module.css';

interface ColorPickerProps {
  label: string;
  value: string;
  swatches: readonly string[];
  onChange: (color: string) => void;
}

/** Swatch grid plus a native colour input for any custom value. */
export function ColorPicker({ label, value, swatches, onChange }: ColorPickerProps) {
  const id = useId();
  const normalized = value.toLowerCase();
  return (
    <fieldset className={styles.fieldset}>
      <legend className={styles.legend}>{label}</legend>
      <div className={styles.swatches} role="radiogroup" aria-label={label}>
        {swatches.map((swatch) => (
          <button
            key={swatch}
            type="button"
            role="radio"
            aria-checked={swatch.toLowerCase() === normalized}
            aria-label={swatch}
            className={cx(styles.swatch, swatch.toLowerCase() === normalized && styles.selected)}
            style={{ backgroundColor: swatch }}
            onClick={() => onChange(swatch)}
          />
        ))}
        <label className={styles.custom} htmlFor={id}>
          <input id={id} type="color" value={normalized} onChange={(event) => onChange(event.target.value)} />
          <span>צבע אחר</span>
        </label>
      </div>
    </fieldset>
  );
}

import { useId } from 'react';
import { Icon } from './Icon';
import styles from './UnderlineSelect.module.css';

interface UnderlineSelectProps<T extends string> {
  label: string;
  value: T;
  options: ReadonlyArray<{ value: T; label: string }>;
  onChange: (value: T) => void;
  /** Hide the floating label (the events tab shows only a placeholder-style label). */
  placeholderStyle?: boolean;
}

/**
 * Material-style "standard" select used for "תצוגה" and "כיתות/קבוצות לימוד": small
 * floating label, value, underline and drop-down arrow. A transparent native <select>
 * covers the whole panel so tapping anywhere opens the iOS picker.
 */
export function UnderlineSelect<T extends string>({ label, value, options, onChange, placeholderStyle }: UnderlineSelectProps<T>) {
  const id = useId();
  const current = options.find((o) => o.value === value);
  return (
    <div className={styles.panel}>
      <div className={styles.field}>
        {placeholderStyle ? (
          <span className={styles.placeholder} aria-hidden="true">
            {current && current.value !== '' ? current.label : label}
          </span>
        ) : (
          <>
            <span className={styles.label} aria-hidden="true">
              {label}
            </span>
            <span className={styles.value} aria-hidden="true">
              {current?.label ?? ''}
            </span>
          </>
        )}
        <Icon name="arrowDropDown" size={24} className={styles.arrow} />
        <label htmlFor={id} className="visually-hidden">
          {label}
        </label>
        <select id={id} className={styles.native} value={value} onChange={(event) => onChange(event.target.value as T)}>
          {options.map((option) => (
            <option key={option.value} value={option.value}>
              {option.label}
            </option>
          ))}
        </select>
      </div>
    </div>
  );
}

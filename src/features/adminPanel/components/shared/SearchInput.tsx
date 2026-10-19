import { Icon } from '../../../../components/ui/Icon';
import styles from './SearchInput.module.css';

interface SearchInputProps {
  value: string;
  onChange: (value: string) => void;
  label: string;
  placeholder?: string;
}

/** Search box with an icon and a clear button. */
export function SearchInput({ value, onChange, label, placeholder }: SearchInputProps) {
  return (
    <div className={styles.wrap}>
      <Icon name="search" size={20} className={styles.icon} />
      <input
        type="search"
        className={styles.input}
        value={value}
        onChange={(event) => onChange(event.target.value)}
        aria-label={label}
        placeholder={placeholder ?? label}
        enterKeyHint="search"
      />
      {value && (
        <button type="button" className={styles.clear} onClick={() => onChange('')} aria-label="ניקוי החיפוש">
          <Icon name="close" size={18} />
        </button>
      )}
    </div>
  );
}

interface FilterChipsProps<T extends string> {
  value: T;
  options: ReadonlyArray<{ value: T; label: string; count?: number }>;
  onChange: (value: T) => void;
  label: string;
}

/** Single-choice filter chips. */
export function FilterChips<T extends string>({ value, options, onChange, label }: FilterChipsProps<T>) {
  return (
    <div className={styles.chips} role="radiogroup" aria-label={label}>
      {options.map((option) => (
        <button
          key={option.value}
          type="button"
          role="radio"
          aria-checked={value === option.value}
          className={value === option.value ? styles.chipOn : styles.chip}
          onClick={() => onChange(option.value)}
        >
          {option.label}
          {option.count !== undefined && <span className={styles.count}>{option.count}</span>}
        </button>
      ))}
    </div>
  );
}

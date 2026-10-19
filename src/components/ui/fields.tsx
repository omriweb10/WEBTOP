/**
 * Labelled form controls for the editor/admin screens. Each renders a native control
 * (best keyboard/VoiceOver support on iOS) with an associated <label> and error text.
 */
import { useId, type InputHTMLAttributes, type ReactNode, type SelectHTMLAttributes, type TextareaHTMLAttributes } from 'react';
import { cx } from '../../utils/classNames';
import styles from './fields.module.css';

interface FieldShellProps {
  label: string;
  hint?: string;
  error?: string;
  id: string;
  children: ReactNode;
}

/** Shared label / hint / error layout. */
function FieldShell({ label, hint, error, id, children }: FieldShellProps) {
  return (
    <div className={cx(styles.field, error && styles.invalid)}>
      <label className={styles.label} htmlFor={id}>
        {label}
      </label>
      {children}
      {error ? (
        <p className={styles.error} id={`${id}-error`} role="alert">
          {error}
        </p>
      ) : (
        hint && (
          <p className={styles.hint} id={`${id}-hint`}>
            {hint}
          </p>
        )
      )}
    </div>
  );
}

interface TextFieldProps extends Omit<InputHTMLAttributes<HTMLInputElement>, 'onChange'> {
  label: string;
  value: string;
  onValueChange: (value: string) => void;
  hint?: string;
  error?: string;
}

/** Single-line text input. */
export function TextField({ label, value, onValueChange, hint, error, id, ...rest }: TextFieldProps) {
  const autoId = useId();
  const fieldId = id ?? autoId;
  return (
    <FieldShell label={label} hint={hint} error={error} id={fieldId}>
      <input
        id={fieldId}
        className={styles.control}
        value={value}
        onChange={(event) => onValueChange(event.target.value)}
        aria-invalid={error ? true : undefined}
        aria-describedby={error ? `${fieldId}-error` : hint ? `${fieldId}-hint` : undefined}
        {...rest}
      />
    </FieldShell>
  );
}

interface TextAreaFieldProps extends Omit<TextareaHTMLAttributes<HTMLTextAreaElement>, 'onChange'> {
  label: string;
  value: string;
  onValueChange: (value: string) => void;
  error?: string;
}

/** Multi-line text input. */
export function TextAreaField({ label, value, onValueChange, error, id, ...rest }: TextAreaFieldProps) {
  const autoId = useId();
  const fieldId = id ?? autoId;
  return (
    <FieldShell label={label} error={error} id={fieldId}>
      <textarea
        id={fieldId}
        className={cx(styles.control, styles.textarea)}
        value={value}
        onChange={(event) => onValueChange(event.target.value)}
        aria-invalid={error ? true : undefined}
        rows={3}
        {...rest}
      />
    </FieldShell>
  );
}

interface SelectFieldProps<T extends string> extends Omit<SelectHTMLAttributes<HTMLSelectElement>, 'onChange' | 'value'> {
  label: string;
  value: T;
  options: ReadonlyArray<{ value: T; label: string }>;
  onValueChange: (value: T) => void;
  hint?: string;
}

/** Native select (renders the iOS picker wheel). */
export function SelectField<T extends string>({ label, value, options, onValueChange, hint, id, ...rest }: SelectFieldProps<T>) {
  const autoId = useId();
  const fieldId = id ?? autoId;
  return (
    <FieldShell label={label} hint={hint} id={fieldId}>
      <select
        id={fieldId}
        className={cx(styles.control, styles.select)}
        value={value}
        onChange={(event) => onValueChange(event.target.value as T)}
        {...rest}
      >
        {options.map((option) => (
          <option key={option.value} value={option.value}>
            {option.label}
          </option>
        ))}
      </select>
    </FieldShell>
  );
}

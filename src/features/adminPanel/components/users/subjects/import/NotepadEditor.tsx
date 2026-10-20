import { useId } from 'react';
import { Icon } from '../../../../../../components/ui/Icon';
import styles from './subjectImport.module.css';

interface NotepadEditorProps {
  value: string;
  onChange: (value: string) => void;
  /** Accessible name of the text area. */
  label: string;
  placeholder: string;
  disabled?: boolean;
}

/** A large, ruled plain-text area in a notepad frame, for pasting text as is (RTL). */
export function NotepadEditor({ value, onChange, label, placeholder, disabled }: NotepadEditorProps) {
  const id = useId();
  const lines = value === '' ? 0 : value.split(/\r\n?|\n/).length;
  return (
    <div className={styles.notepad}>
      <div className={styles.notepadBar} aria-hidden="true">
        <span className={styles.fileName}>
          <Icon name="description" size={16} />
          מקצועות.txt
        </span>
        <span>{lines === 1 ? 'שורה אחת' : `${lines} שורות`}</span>
      </div>
      <label htmlFor={id} className="visually-hidden">
        {label}
      </label>
      <textarea
        id={id}
        className={styles.textarea}
        dir="rtl"
        value={value}
        placeholder={placeholder}
        onChange={(event) => onChange(event.target.value)}
        spellCheck={false}
        autoCorrect="off"
        autoCapitalize="off"
        disabled={disabled}
        data-selectable
      />
    </div>
  );
}

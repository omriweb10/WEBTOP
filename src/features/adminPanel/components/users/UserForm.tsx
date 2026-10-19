import { useState, type FormEvent } from 'react';
import { Button } from '../../../../components/ui/Button';
import { TextAreaField, TextField } from '../../../../components/ui/fields';
import type { ProfileFields } from '../../api/types';
import { cleanProfile, PROFILE_LIMITS, validateProfile } from '../../domain/profileForm';
import styles from './users.module.css';

interface UserFormProps {
  initial: ProfileFields;
  submitLabel: string;
  /** Saves the cleaned fields; resolves to an error message or null. */
  onSubmit: (fields: ProfileFields) => Promise<string | null>;
  onCancel?: () => void;
}

/** Personal details: display name, class, school, short description. */
export function UserForm({ initial, submitLabel, onSubmit, onCancel }: UserFormProps) {
  const [fields, setFields] = useState(initial);
  const [showErrors, setShowErrors] = useState(false);
  const [busy, setBusy] = useState(false);
  const [failure, setFailure] = useState<string | null>(null);
  const errors = validateProfile(fields);
  const shown = showErrors ? errors : {};

  /** Updates one field. */
  const set = (key: keyof ProfileFields) => (value: string) => setFields((current) => ({ ...current, [key]: value }));

  /** Validates, then saves. */
  const submit = async (event: FormEvent) => {
    event.preventDefault();
    if (Object.keys(errors).length > 0) {
      setShowErrors(true);
      return;
    }
    setBusy(true);
    setFailure(await onSubmit(cleanProfile(fields)));
    setBusy(false);
  };

  return (
    <form onSubmit={(event) => void submit(event)} noValidate>
      <TextField label="שם תצוגה *" value={fields.display_name} onValueChange={set('display_name')} maxLength={PROFILE_LIMITS.display_name} error={shown.display_name} autoComplete="off" />
      <div className={styles.twoColumns}>
        <TextField label="כיתה / שכבה" value={fields.class_name} onValueChange={set('class_name')} maxLength={PROFILE_LIMITS.class_name} error={shown.class_name} placeholder="למשל י' 2" />
        <TextField label="בית ספר (רשות)" value={fields.school_name} onValueChange={set('school_name')} maxLength={PROFILE_LIMITS.school_name} error={shown.school_name} />
      </div>
      <TextAreaField label={`תיאור קצר (רשות, עד ${PROFILE_LIMITS.bio} תווים)`} value={fields.bio} onValueChange={set('bio')} maxLength={PROFILE_LIMITS.bio} error={shown.bio} />
      {failure && (
        <p className={styles.formError} role="alert">
          {failure}
        </p>
      )}
      <div className={styles.formActions}>
        <Button type="submit" variant="primary" disabled={busy}>
          {busy ? 'שומר…' : submitLabel}
        </Button>
        {onCancel && (
          <Button variant="secondary" onClick={onCancel} disabled={busy}>
            ביטול
          </Button>
        )}
      </div>
    </form>
  );
}

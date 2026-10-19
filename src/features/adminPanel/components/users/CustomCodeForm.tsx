import { useState, type FormEvent } from 'react';
import { estimateCodeStrength, MAX_CODE_LENGTH, normalizeAccessCode } from '../../../../../supabase/functions/_shared/accessCode';
import { Button } from '../../../../components/ui/Button';
import { cx } from '../../../../utils/classNames';
import styles from './codes.module.css';

const LEVEL_LABEL = { too_short: 'קצר מדי', weak: 'חלש', fair: 'בינוני', strong: 'חזק' } as const;

interface CustomCodeFormProps {
  busy: boolean;
  onSubmit: (code: string, allowWeak: boolean) => void;
  onCancel: () => void;
}

/** Manual code entry with a live strength meter and an explicit opt-in for weak codes. */
export function CustomCodeForm({ busy, onSubmit, onCancel }: CustomCodeFormProps) {
  const [code, setCode] = useState('');
  const [allowWeak, setAllowWeak] = useState(false);
  const normalized = normalizeAccessCode(code);
  const strength = estimateCodeStrength(normalized);
  const weak = strength.level === 'weak';
  const blocked = strength.level === 'too_short' || normalized.length > MAX_CODE_LENGTH || (weak && !allowWeak);

  /** Sends the code when it is acceptable. */
  const submit = (event: FormEvent) => {
    event.preventDefault();
    if (!blocked) onSubmit(code, allowWeak);
  };

  return (
    <form className={styles.customForm} onSubmit={submit} noValidate>
      <label className={styles.label} htmlFor="custom-code">
        קוד מותאם אישית
      </label>
      <input
        id="custom-code"
        className={styles.input}
        value={code}
        onChange={(event) => setCode(event.target.value.slice(0, 100))}
        dir="ltr"
        autoComplete="off"
        autoCapitalize="characters"
        spellCheck={false}
        placeholder="לפחות 6 תווים; מומלץ 10+ אותיות וספרות"
      />
      <div className={styles.meter} aria-hidden="true">
        <span className={cx(styles.meterFill, styles[strength.level])} style={{ width: `${Math.min(100, (strength.bits / 60) * 100)}%` }} />
      </div>
      <p className={styles.level} aria-live="polite">
        חוזק: <strong>{LEVEL_LABEL[strength.level]}</strong>
        {normalized && ` · ${normalized.length} תווים`}
      </p>
      {strength.warnings.length > 0 && (
        <ul className={styles.warnings}>
          {strength.warnings.map((warning) => (
            <li key={warning}>{warning}</li>
          ))}
        </ul>
      )}
      {weak && (
        <label className={styles.allowWeak}>
          <input type="checkbox" checked={allowWeak} onChange={(event) => setAllowWeak(event.target.checked)} />
          אני מבין/ה שהקוד חלש וקל יותר לניחוש, ובכל זאת רוצה להשתמש בו
        </label>
      )}
      <div className={styles.dialogActions}>
        <Button type="submit" variant="primary" disabled={busy || blocked}>
          {busy ? 'שומר…' : 'שמירת הקוד'}
        </Button>
        <Button variant="secondary" onClick={onCancel} disabled={busy}>
          ביטול
        </Button>
      </div>
    </form>
  );
}

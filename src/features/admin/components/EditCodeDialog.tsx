import { useState, type FormEvent } from 'react';
import { Button } from '../../../components/ui/Button';
import { TextField } from '../../../components/ui/fields';
import { Modal } from '../../../components/ui/Modal';
import { toast } from '../../../store/uiStore';
import { useEditModeStore } from '../editModeStore';
import styles from './EditCodeDialog.module.css';

const INPUT_ID = 'edit-code-input';

/** Prompt for the demonstration code that unlocks the local edit mode. */
export function EditCodeDialog() {
  const open = useEditModeStore((state) => state.promptOpen);
  const close = useEditModeStore((state) => state.closePrompt);
  const unlock = useEditModeStore((state) => state.unlock);
  const [code, setCode] = useState('');
  const [error, setError] = useState<string | undefined>();

  /** Clears the field and error, then closes. */
  const dismiss = () => {
    setCode('');
    setError(undefined);
    close();
  };

  /** Validates the code and enters edit mode on success. */
  const submit = (event: FormEvent) => {
    event.preventDefault();
    if (unlock(code)) {
      setCode('');
      setError(undefined);
      toast('מצב עריכה מקומי הופעל. השינויים נשמרים רק במכשיר הזה.', { tone: 'success', duration: 4500 });
    } else {
      setError('הקוד שגוי');
    }
  };

  return (
    <Modal open={open} variant="dialog" title="מצב עריכה מקומי" onClose={dismiss} initialFocusId={INPUT_ID}>
      <form onSubmit={submit} noValidate>
        <p className={styles.note}>
          זהו מצב עריכה של עותק אישי ולא רשמי. הקוד הוא נוחות ממשק בלבד — הוא אינו סיסמה, אינו מגן על מידע ואינו
          קשור לחשבון WEBTOP כלשהו.
        </p>
        <TextField
          id={INPUT_ID}
          label="קוד"
          value={code}
          onValueChange={(value) => {
            setCode(value.replace(/\D/g, '').slice(0, 6));
            setError(undefined);
          }}
          inputMode="numeric"
          autoComplete="off"
          enterKeyHint="go"
          pattern="[0-9]*"
          maxLength={6}
          error={error}
        />
        <div className={styles.actions}>
          <Button type="submit" variant="primary" disabled={code.length === 0}>
            כניסה
          </Button>
          <Button variant="secondary" onClick={dismiss}>
            ביטול
          </Button>
        </div>
      </form>
    </Modal>
  );
}

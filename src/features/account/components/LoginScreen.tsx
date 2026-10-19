import { useState, type FormEvent } from 'react';
import { Button } from '../../../components/ui/Button';
import { Icon } from '../../../components/ui/Icon';
import { APP_NAME } from '../../../config/branding';
import { useAccountStore } from '../accountStore';
import { loginFailureMessage, signOutMessage } from '../domain/loginMessages';
import styles from './LoginScreen.module.css';

const CODE_INPUT_ID = 'access-code';

/**
 * The only way in for students: one field for the personal access code an administrator
 * issued. What the app is, and that the code is never a school password, is explained in
 * Settings → About.
 */
export function LoginScreen() {
  const login = useAccountStore((state) => state.actions?.login);
  const reason = useAccountStore((state) => state.signOutReason);
  const [code, setCode] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  /** Sends the code; the runtime switches the app to the signed-in state on success. */
  const submit = async (event: FormEvent) => {
    event.preventDefault();
    if (!login || busy || code.trim().length === 0) return;
    setBusy(true);
    setError(null);
    const failure = await login(code);
    setBusy(false);
    if (failure) setError(loginFailureMessage(failure));
  };

  return (
    <div className={styles.page}>
      <form className={styles.card} onSubmit={(event) => void submit(event)} noValidate aria-labelledby="login-title">
        <div className={styles.brand}>
          <Icon name="school" size={26} />
          <span className={styles.brandName}>{APP_NAME}</span>
        </div>
        <h1 id="login-title" className={styles.title}>
          כניסה עם קוד אישי
        </h1>
        <p className={styles.lead}>הזינו את קוד הגישה האישי שקיבלתם ממנהל האפליקציה.</p>

        {reason && !error && (
          <p className={styles.info} role="status">
            {signOutMessage(reason)}
          </p>
        )}

        <label className={styles.label} htmlFor={CODE_INPUT_ID}>
          קוד גישה
        </label>
        <input
          id={CODE_INPUT_ID}
          className={styles.input}
          value={code}
          onChange={(event) => {
            setCode(event.target.value.slice(0, 80));
            setError(null);
          }}
          dir="ltr"
          autoComplete="off"
          autoCorrect="off"
          autoCapitalize="characters"
          spellCheck={false}
          enterKeyHint="go"
          placeholder="XXXX-XXXX-XXXX"
          aria-invalid={error ? true : undefined}
          aria-describedby={error ? 'login-error' : undefined}
          disabled={busy}
        />
        {error && (
          <p id="login-error" className={styles.error} role="alert">
            {error}
          </p>
        )}

        <Button type="submit" variant="primary" block disabled={busy || code.trim().length === 0 || !login}>
          {busy ? 'מתחבר…' : 'כניסה'}
        </Button>

      </form>
    </div>
  );
}

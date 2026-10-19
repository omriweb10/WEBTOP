import { useState, type FormEvent } from 'react';
import { navigate } from '../../../app/router';
import { Button } from '../../../components/ui/Button';
import { TextField } from '../../../components/ui/fields';
import { Icon } from '../../../components/ui/Icon';
import { useAdminAuth } from '../state/adminAuthStore';
import styles from './AdminLogin.module.css';

/** Administrator sign-in (Supabase Auth). Separate from students' access codes. */
export function AdminLogin() {
  const signIn = useAdminAuth((state) => state.signIn);
  const notice = useAdminAuth((state) => state.notice);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [busy, setBusy] = useState(false);

  /** Signs in; the store switches to the panel when the account is an admin. */
  const submit = async (event: FormEvent) => {
    event.preventDefault();
    if (busy) return;
    setBusy(true);
    const ok = await signIn(email, password);
    setBusy(false);
    if (ok) setPassword('');
  };

  return (
    <div className={styles.page}>
      <form className={styles.card} onSubmit={(event) => void submit(event)} noValidate>
        <div className={styles.brand}>
          <Icon name="adminPanel" size={26} />
          <span>ממשק ניהול</span>
        </div>
        <h1 className={styles.title}>כניסת מנהל</h1>
        <p className={styles.lead}>התחברות עם חשבון המנהל של הפרויקט. קודי גישה של תלמידים אינם פועלים כאן.</p>
        {notice && (
          <p className={styles.notice} role="alert">
            {notice}
          </p>
        )}
        <TextField label="אימייל" type="email" value={email} onValueChange={setEmail} autoComplete="username" dir="ltr" required />
        <TextField
          label="סיסמה"
          type="password"
          value={password}
          onValueChange={setPassword}
          autoComplete="current-password"
          dir="ltr"
          required
        />
        <Button type="submit" variant="primary" block disabled={busy || !email || !password}>
          {busy ? 'מתחבר…' : 'כניסה'}
        </Button>
        <button type="button" className={styles.back} onClick={() => navigate({ name: 'schedule', tab: 'timetable' })}>
          חזרה לאפליקציה
        </button>
      </form>
    </div>
  );
}

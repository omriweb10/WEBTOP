import { navigate } from '../../../app/router';
import { Avatar } from '../../../components/ui/Avatar';
import { useAccountStore, useAccountSummary } from '../accountStore';
import styles from './AccountHeaderButton.module.css';

/** The student's picture in the app bar; opens the account section in settings. */
export function AccountHeaderButton() {
  const summary = useAccountSummary();
  const avatarUrl = useAccountStore((state) => state.avatarUrl);
  if (!summary) return null;
  return (
    <button
      type="button"
      className={styles.button}
      aria-label={`החשבון של ${summary.displayName}`}
      title={summary.displayName}
      onClick={() => navigate({ name: 'settings' })}
    >
      <Avatar name={summary.displayName} src={avatarUrl} size={30} />
    </button>
  );
}

import { Icon } from './Icon';
import styles from './AddButton.module.css';

/** Compact "+ הוספה" pill used in section headers while editing. */
export function AddButton({ label, onClick }: { label: string; onClick: () => void }) {
  return (
    <button type="button" className={styles.add} onClick={onClick}>
      <Icon name="add" size={18} />
      <span>{label}</span>
    </button>
  );
}

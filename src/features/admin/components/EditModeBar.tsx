import { navigate, useRoute } from '../../../app/router';
import { Icon } from '../../../components/ui/Icon';
import { accountMode } from '../../../config/backend';
import { toast } from '../../../store/uiStore';
import { useEditModeStore } from '../editModeStore';
import styles from './EditModeBar.module.css';

/** Strip shown under the app bar while editing: the mode's name, tools, exit. */
export function EditModeBar() {
  const lock = useEditModeStore((state) => state.lock);
  const route = useRoute();
  return (
    <div className={styles.bar} role="region" aria-label="מצב עריכה">
      <Icon name="edit" size={18} className={styles.icon} />
      <p className={styles.text}>
        <strong>{accountMode ? 'עריכת המערכת שלי' : 'מצב עריכה'}</strong>
      </p>
      {!accountMode && route.name !== 'tools' && (
        <button type="button" className={styles.button} onClick={() => navigate({ name: 'tools' })}>
          כלים
        </button>
      )}
      <button
        type="button"
        className={styles.button}
        onClick={() => {
          lock();
          if (route.name === 'tools') navigate({ name: 'schedule', tab: 'timetable' }, { replace: true });
          toast('יצאת ממצב העריכה');
        }}
      >
        יציאה
      </button>
    </div>
  );
}

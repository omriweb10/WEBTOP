import { navigate, useRoute } from '../../../app/router';
import { Icon } from '../../../components/ui/Icon';
import { toast } from '../../../store/uiStore';
import { useEditModeStore } from '../editModeStore';
import styles from './EditModeBar.module.css';

/** Strip shown under the app bar while editing: clear "personal copy" notice, tools, exit. */
export function EditModeBar() {
  const lock = useEditModeStore((state) => state.lock);
  const route = useRoute();
  return (
    <div className={styles.bar} role="region" aria-label="מצב עריכה">
      <Icon name="edit" size={18} className={styles.icon} />
      <p className={styles.text}>
        <strong>מצב עריכה</strong> · שינויים נשמרים בעותק האישי במכשיר זה בלבד
      </p>
      {route.name !== 'admin' && (
        <button type="button" className={styles.button} onClick={() => navigate({ name: 'admin' })}>
          כלים
        </button>
      )}
      <button
        type="button"
        className={styles.button}
        onClick={() => {
          lock();
          if (route.name === 'admin') navigate({ name: 'schedule', tab: 'timetable' }, { replace: true });
          toast('יצאת ממצב העריכה');
        }}
      >
        יציאה
      </button>
    </div>
  );
}

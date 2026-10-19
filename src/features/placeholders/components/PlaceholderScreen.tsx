import { PLACEHOLDER_TITLES } from '../../../app/navigation';
import { navigate, type PlaceholderId } from '../../../app/router';
import { ScreenFrame } from '../../../components/layout/ScreenFrame';
import { Button } from '../../../components/ui/Button';
import { Icon } from '../../../components/ui/Icon';
import styles from './PlaceholderScreen.module.css';

/**
 * Clearly-labelled local placeholder for menu entries that exist in the official system
 * but have no local equivalent here. No data is fetched and nothing is simulated.
 */
export function PlaceholderScreen({ id }: { id: PlaceholderId }) {
  const title = PLACEHOLDER_TITLES[id];
  return (
    <ScreenFrame title={title}>
      <div className={styles.page}>
        <section className={styles.card} aria-labelledby="placeholder-title">
          <Icon name="info" size={36} className={styles.icon} />
          <h2 id="placeholder-title" className={styles.heading}>
            מסך מקום־שמור (Placeholder)
          </h2>
          <p className={styles.text}>
            „{title}” קיים רק במערכת הרשמית. בגרסה המקומית והלא־רשמית הזו אין למסך הזה תוכן, ואין חיבור לשרתים של WEBTOP או
            של בית הספר.
          </p>
          <Button variant="primary" icon="tableChart" onClick={() => navigate({ name: 'schedule', tab: 'timetable' })}>
            למערכת השעות
          </Button>
        </section>
      </div>
    </ScreenFrame>
  );
}

import { SectionCard } from '../../../components/ui/SectionCard';
import { accountMode } from '../../../config/backend';
import { aboutContent } from '../domain/aboutContent';
import { StorageNotice } from './StorageNotice';
import styles from './SettingsScreen.module.css';

/** Settings → About: what the app is, its independence from WEBTOP, sign-in and storage. */
export function AboutSection() {
  const content = aboutContent(accountMode ? 'account' : 'local');
  return (
    <SectionCard id="about" title="אודות">
      <div className={styles.body}>
        <p className={styles.lead}>{content.intro}</p>
        <div className={styles.independence}>
          {content.independence.map((line) => (
            <p key={line}>{line}</p>
          ))}
        </div>
        <ul className={styles.facts}>
          {content.facts.map((fact) => (
            <li key={fact}>{fact}</li>
          ))}
        </ul>
        {!accountMode && <StorageNotice />}
      </div>
    </SectionCard>
  );
}

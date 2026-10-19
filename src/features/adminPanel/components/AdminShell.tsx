import { navigate, useRoute, type AdminSection } from '../../../app/router';
import { Icon } from '../../../components/ui/Icon';
import { IconButton } from '../../../components/ui/IconButton';
import type { IconName } from '../../../components/ui/icons/iconPaths';
import { ThemeSelector } from '../../../theme/components/ThemeSelector';
import { cx } from '../../../utils/classNames';
import { useAdminAuth } from '../state/adminAuthStore';
import { ContentSection } from './content/ContentSection';
import { PresetsSection } from './presets/PresetsSection';
import { SessionsSection } from './sessions/SessionsSection';
import { TemplatesSection } from './templates/TemplatesSection';
import { UserDetail } from './users/UserDetail';
import { UsersSection } from './users/UsersSection';
import styles from './AdminShell.module.css';

const SECTIONS: ReadonlyArray<{ id: AdminSection; label: string; icon: IconName }> = [
  { id: 'users', label: 'משתמשים', icon: 'group' },
  { id: 'sessions', label: 'חיבורים', icon: 'devices' },
  { id: 'presets', label: 'מאגר', icon: 'palette' },
  { id: 'templates', label: 'תבניות', icon: 'tableChart' },
  { id: 'content', label: 'הודעות', icon: 'campaign' },
];

/** Signed-in admin layout: top bar, section navigation (bottom bar on phones, rail on wide screens). */
export function AdminShell() {
  const route = useRoute();
  const email = useAdminAuth((state) => state.email);
  const signOut = useAdminAuth((state) => state.signOut);
  const section = route.name === 'admin' ? route.section : 'users';
  const id = route.name === 'admin' ? route.id : undefined;

  return (
    <div className={styles.shell}>
      <header className={styles.topbar}>
        <Icon name="adminPanel" size={24} className={styles.logo} />
        <span className={styles.brand}>ניהול WEBTOP</span>
        <span className={styles.email} dir="ltr">
          {email}
        </span>
        <ThemeSelector variant="compact" />
        <IconButton icon="logout" label="התנתקות מממשק הניהול" onClick={() => void signOut()} />
      </header>
      <nav className={styles.nav} aria-label="אזורי ניהול">
        {SECTIONS.map((item) => (
          <button
            key={item.id}
            type="button"
            className={cx(styles.navItem, section === item.id && styles.navActive)}
            aria-current={section === item.id ? 'page' : undefined}
            onClick={() => navigate({ name: 'admin', section: item.id })}
          >
            <Icon name={item.icon} size={22} />
            <span>{item.label}</span>
          </button>
        ))}
      </nav>
      <main className={styles.main}>
        {section === 'users' && (id ? <UserDetail key={id} profileId={id} /> : <UsersSection />)}
        {section === 'sessions' && <SessionsSection />}
        {section === 'presets' && <PresetsSection />}
        {section === 'templates' && <TemplatesSection />}
        {section === 'content' && <ContentSection />}
      </main>
    </div>
  );
}

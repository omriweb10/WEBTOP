import { Icon } from '../../components/ui/Icon';
import type { IconName } from '../../components/ui/icons/iconPaths';
import { cx } from '../../utils/classNames';
import { THEME_LABELS, THEME_PREFERENCES, type ThemePreference } from '../themeConfig';
import { setThemePreference, useThemePreference } from '../themeStore';
import { useResolvedTheme } from '../useResolvedTheme';
import styles from './ThemeSelector.module.css';

const ICONS: Record<ThemePreference, IconName> = { light: 'lightMode', dark: 'darkMode', system: 'themeAuto' };

interface ThemeSelectorProps {
  /** "full": icons with labels (Settings); "compact": icons only, for a navy app bar. */
  variant?: 'full' | 'compact';
}

/** Light / Dark / System choice. Applies immediately and is remembered on this device. */
export function ThemeSelector({ variant = 'full' }: ThemeSelectorProps) {
  const preference = useThemePreference();
  const resolved = useResolvedTheme();
  const compact = variant === 'compact';
  return (
    <div className={compact ? styles.compactWrap : undefined}>
      <div className={cx(styles.group, compact && styles.compact)} role="radiogroup" aria-label="ערכת נושא">
        {THEME_PREFERENCES.map((option) => (
          <button
            key={option}
            type="button"
            role="radio"
            aria-checked={preference === option}
            aria-label={compact ? `ערכת נושא: ${THEME_LABELS[option]}` : undefined}
            title={compact ? THEME_LABELS[option] : undefined}
            className={cx(styles.option, preference === option && styles.selected)}
            onClick={() => setThemePreference(option)}
          >
            <Icon name={ICONS[option]} size={compact ? 18 : 20} />
            {!compact && <span>{THEME_LABELS[option]}</span>}
          </button>
        ))}
      </div>
      {!compact && preference === 'system' && (
        <p className={styles.hint}>המראה עוקב אחרי הגדרות המכשיר (כרגע: {THEME_LABELS[resolved]}).</p>
      )}
    </div>
  );
}

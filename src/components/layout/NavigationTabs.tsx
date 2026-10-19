import { useRef, type KeyboardEvent } from 'react';
import { cx } from '../../utils/classNames';
import styles from './NavigationTabs.module.css';

export interface TabItem<T extends string> {
  id: T;
  label: string;
}

interface NavigationTabsProps<T extends string> {
  tabs: ReadonlyArray<TabItem<T>>;
  active: T;
  onChange: (id: T) => void;
  /** id prefix used to link tabs and their panel (aria-controls). */
  idPrefix: string;
}

/** Equal-width tab strip with an underline indicator; arrow keys move between tabs. */
export function NavigationTabs<T extends string>({ tabs, active, onChange, idPrefix }: NavigationTabsProps<T>) {
  const refs = useRef<Array<HTMLButtonElement | null>>([]);

  /** Roving focus per WAI-ARIA tabs pattern (RTL: ArrowLeft moves to the next tab). */
  const onKeyDown = (event: KeyboardEvent<HTMLButtonElement>, index: number) => {
    const delta = event.key === 'ArrowLeft' ? 1 : event.key === 'ArrowRight' ? -1 : 0;
    if (!delta) return;
    event.preventDefault();
    const next = (index + delta + tabs.length) % tabs.length;
    const tab = tabs[next];
    if (!tab) return;
    refs.current[next]?.focus();
    onChange(tab.id);
  };

  return (
    <div className={styles.tabs} role="tablist">
      {tabs.map((tab, index) => {
        const selected = tab.id === active;
        return (
          <button
            key={tab.id}
            ref={(el) => {
              refs.current[index] = el;
            }}
            type="button"
            role="tab"
            id={`${idPrefix}-tab-${tab.id}`}
            aria-selected={selected}
            aria-controls={`${idPrefix}-panel`}
            tabIndex={selected ? 0 : -1}
            className={cx(styles.tab, selected && styles.selected)}
            onClick={() => onChange(tab.id)}
            onKeyDown={(event) => onKeyDown(event, index)}
          >
            {tab.label}
          </button>
        );
      })}
    </div>
  );
}

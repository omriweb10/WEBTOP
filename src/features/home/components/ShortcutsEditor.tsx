import { useState } from 'react';
import { Button } from '../../../components/ui/Button';
import { Modal } from '../../../components/ui/Modal';
import { SHORTCUT_IDS, type ShortcutId } from '../../../schemas/content';
import { useSettingsStore } from '../../../store/dataStores';
import { SHORTCUTS } from '../shortcuts';
import styles from './HomeScreen.module.css';

/** Dialog (mounted only while open) choosing which shortcut tiles appear on the home screen. */
export function ShortcutsEditor({ onClose }: { onClose: () => void }) {
  const update = useSettingsStore((state) => state.update);
  const [selected, setSelected] = useState<ShortcutId[]>(() => useSettingsStore.getState().value.shortcuts);

  /** Adds or removes one shortcut, keeping the canonical order. */
  const toggle = (id: ShortcutId) =>
    setSelected((list) => SHORTCUT_IDS.filter((s) => (s === id ? !list.includes(id) : list.includes(s))));

  return (
    <Modal
      open
      title="עריכת קיצורי דרך"
      onClose={onClose}
      footer={
        <>
          <Button
            variant="primary"
            onClick={() => {
              update((s) => ({ ...s, shortcuts: selected }));
              onClose();
            }}
          >
            שמירה
          </Button>
          <Button onClick={onClose}>ביטול</Button>
        </>
      }
    >
      <div className={styles.checklist}>
        {SHORTCUT_IDS.map((id) => (
          <label key={id} className={styles.checkRow}>
            <input type="checkbox" checked={selected.includes(id)} onChange={() => toggle(id)} />
            <span>{SHORTCUTS[id].label}</span>
          </label>
        ))}
      </div>
    </Modal>
  );
}

import { useState } from 'react';
import { Button } from '../../../components/ui/Button';
import { confirm } from '../../../components/ui/confirmStore';
import { IconButton } from '../../../components/ui/IconButton';
import type { Preset } from '../../../schemas/presets';
import { usePresetsStore, useTimetableStore } from '../../../store/dataStores';
import { toast } from '../../../store/uiStore';
import { countLessonsUsingPreset } from '../domain/presetOps';
import { presetActions } from '../presetActions';
import { PresetForm } from './PresetForm';
import styles from './PresetManager.module.css';

/** List of subject presets with create / edit / delete / reset. */
export function PresetManager() {
  const presets = usePresetsStore((state) => state.value);
  const timetable = useTimetableStore((state) => state.value);
  const [target, setTarget] = useState<Preset | 'new' | null>(null);

  /** Confirms and deletes a preset (its lessons keep their content). */
  const remove = async (preset: Preset) => {
    const usage = countLessonsUsingPreset(timetable, preset.id);
    const ok = await confirm({
      title: 'מחיקת תבנית',
      message: `למחוק את התבנית „${preset.name}”?${usage ? `\n${usage} שיעורים ישמרו את התוכן שלהם וינותקו מהתבנית.` : ''}`,
      confirmLabel: 'מחיקה',
      tone: 'danger',
    });
    if (!ok) return;
    presetActions.remove(preset.id);
    toast('התבנית נמחקה');
  };

  /** Confirms and restores the default preset list. */
  const reset = async () => {
    const ok = await confirm({
      title: 'איפוס תבניות',
      message: 'להחזיר את רשימת התבניות לברירת המחדל? שיעורים קיימים לא ישתנו.',
      confirmLabel: 'איפוס',
      tone: 'danger',
    });
    if (ok) {
      presetActions.resetToDefault();
      toast('התבניות אופסו');
    }
  };

  return (
    <>
      <ul className={styles.list}>
        {presets.map((preset) => (
          <li key={preset.id} className={styles.item}>
            <span className={styles.swatch} style={{ backgroundColor: preset.color }} aria-hidden="true" />
            <div className={styles.text}>
              <strong>{preset.name}</strong>
              <span className={styles.meta}>
                {[preset.subject, preset.teacher, preset.room && `חדר ${preset.room}`].filter(Boolean).join(' · ')}
              </span>
              <span className={styles.meta}>בשימוש ב־{countLessonsUsingPreset(timetable, preset.id)} שיעורים</span>
            </div>
            <IconButton icon="edit" label={`עריכת ${preset.name}`} iconSize={20} onClick={() => setTarget(preset)} />
            <IconButton icon="delete" label={`מחיקת ${preset.name}`} iconSize={20} onClick={() => void remove(preset)} />
          </li>
        ))}
      </ul>
      <div className={styles.actions}>
        <Button icon="add" variant="primary" onClick={() => setTarget('new')}>
          תבנית חדשה
        </Button>
        <Button icon="restart" variant="danger" onClick={() => void reset()}>
          איפוס תבניות
        </Button>
      </div>
      {target && <PresetForm target={target} onClose={() => setTarget(null)} />}
    </>
  );
}

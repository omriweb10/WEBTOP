import { useState } from 'react';
import { Button } from '../../../components/ui/Button';
import { Modal } from '../../../components/ui/Modal';
import type { Preset } from '../../../schemas/presets';
import { usePresetsStore, useTimetableStore } from '../../../store/dataStores';
import { useAccountSummary } from '../../account/accountStore';
import { lessonFromPreset } from '../../presets/domain/presetOps';
import { EMPTY_PRESET, PresetPicker } from '../../presets/components/PresetPicker';
import { getDayInfo } from '../domain/days';
import { formatPeriodRange } from '../domain/periods';
import { getLesson, type Slot } from '../domain/timetableOps';
import { timetableActions } from '../timetableActions';
import { LessonCard } from './LessonCard';
import { SavedLessonActions } from './SavedLessonActions';
import styles from './LessonEditor.module.css';

interface AssignedLessonEditorProps {
  slot: Slot;
  onClose: () => void;
}

/**
 * Account-mode cell editor: the student picks one of the subjects an administrator
 * assigned (or an empty period). Teacher, room and colour come from the subject and
 * cannot be changed here; the server enforces the same rule.
 */
export function AssignedLessonEditor({ slot, onClose }: AssignedLessonEditorProps) {
  const timetable = useTimetableStore((state) => state.value);
  const presets = usePresetsStore((state) => state.value);
  const assignable = useAccountSummary()?.assignablePresetIds;
  const saved = getLesson(timetable, slot);
  const [selected, setSelected] = useState<string>(saved?.presetId ?? EMPTY_PRESET);

  const allowed = new Set(assignable ?? []);
  if (saved?.presetId) allowed.add(saved.presetId);
  const choices = presets.filter((p) => allowed.has(p.id));
  const preset: Preset | undefined = choices.find((p) => p.id === selected);

  const period = timetable.periods[slot.index];
  const title = `${getDayInfo(slot.day).name} · שעה ${slot.index + 1}${period ? ` (${formatPeriodRange(period)})` : ''}`;

  /** Saves the chosen subject (or an empty period). */
  const save = () => {
    if (preset) timetableActions.saveLesson(slot, lessonFromPreset(preset, saved?.id));
    else timetableActions.clear(slot);
    onClose();
  };

  return (
    <Modal
      open
      title={title}
      onClose={onClose}
      footer={
        <>
          <Button variant="primary" onClick={save}>
            שמירה
          </Button>
          <Button variant="secondary" onClick={onClose}>
            ביטול
          </Button>
        </>
      }
    >
      <h3 className={styles.heading}>בחירת מקצוע</h3>
      {choices.length === 0 ? (
        <p className={styles.note}>עדיין לא הוקצו לך מקצועות. אפשר לסמן שעה ריקה, או לבקש מהמנהל להקצות מקצועות.</p>
      ) : (
        <p className={styles.note}>המקצועות, המורים, החדרים והצבעים מוגדרים על ידי מנהל האפליקציה.</p>
      )}
      <PresetPicker
        presets={choices}
        selected={preset ? preset.id : EMPTY_PRESET}
        onSelectPreset={(p) => setSelected(p.id)}
        onSelectEmpty={() => setSelected(EMPTY_PRESET)}
      />

      <h3 className={styles.heading}>תצוגה מקדימה</h3>
      <div className={styles.preview}>
        {preset ? <LessonCard lesson={lessonFromPreset(preset, 'preview')} /> : <p className={styles.emptyPreview}>שעה ריקה</p>}
      </div>

      {saved && <SavedLessonActions timetable={timetable} slot={slot} saved={saved} onDone={onClose} />}
    </Modal>
  );
}

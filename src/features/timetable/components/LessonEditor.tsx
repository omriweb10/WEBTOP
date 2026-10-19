import { useMemo, useState } from 'react';
import { Button } from '../../../components/ui/Button';
import { ColorPicker } from '../../../components/ui/ColorPicker';
import { TextField } from '../../../components/ui/fields';
import { Modal } from '../../../components/ui/Modal';
import { COLOR_SWATCHES } from '../../../data/subjectPalette';
import { usePresetsStore, useTimetableStore } from '../../../store/dataStores';
import { createId } from '../../../utils/id';
import { customizedFields } from '../../presets/domain/presetOps';
import { EMPTY_PRESET, PresetPicker } from '../../presets/components/PresetPicker';
import { getDayInfo } from '../domain/days';
import { formatPeriodRange } from '../domain/periods';
import {
  blankDraft,
  draftFromLesson,
  draftFromPreset,
  draftToLesson,
  EMPTY_DRAFT,
  validateDraft,
  type LessonDraft,
  type LessonFields,
} from '../domain/lessonDraft';
import { getLesson, type Slot } from '../domain/timetableOps';
import { timetableActions } from '../timetableActions';
import { LessonCard } from './LessonCard';
import { SavedLessonActions } from './SavedLessonActions';
import styles from './LessonEditor.module.css';

const FIELD_LABELS: Record<string, string> = { subject: 'מקצוע', teacher: 'מורה', room: 'חדר', color: 'צבע' };

interface LessonEditorProps {
  slot: Slot;
  onClose: () => void;
}

/**
 * Bottom-sheet editor for one timetable cell (edit mode only): pick a preset or empty
 * period, override individual fields, preview, save — plus duplicate / move / copy /
 * delete for an existing lesson. All rules live in domain modules and timetableActions.
 * Mounted only while open (keyed by slot), so the draft is initialised from the cell.
 */
export function LessonEditor({ slot, onClose }: LessonEditorProps) {
  const timetable = useTimetableStore((state) => state.value);
  const presets = usePresetsStore((state) => state.value);
  const saved = getLesson(timetable, slot);
  const [draft, setDraft] = useState<LessonDraft>(() => draftFromLesson(saved));
  const [showErrors, setShowErrors] = useState(false);

  const errors = useMemo(() => validateDraft(draft), [draft]);
  const preset = !draft.empty && draft.presetId ? presets.find((p) => p.id === draft.presetId) : undefined;
  const custom = preset && !draft.empty ? customizedFields({ ...draft, id: 'x' }, preset) : [];

  const period = timetable.periods[slot.index];
  const title = `${getDayInfo(slot.day).name} · שעה ${slot.index + 1}${period ? ` (${formatPeriodRange(period)})` : ''}`;

  /** Updates one field; typing into an empty period starts a custom lesson. */
  const setField = (field: keyof Omit<LessonFields, 'presetId'>, value: string) => {
    setDraft((current) => ({ ...(current.empty ? blankDraft(COLOR_SWATCHES[0] ?? '#999a9d') : current), [field]: value }) as LessonDraft);
  };

  /** Validates and saves (an empty draft saves an empty period). */
  const save = () => {
    if (Object.keys(errors).length > 0) {
      setShowErrors(true);
      return;
    }
    const lesson = draftToLesson(draft, saved?.id ?? createId('lsn'));
    if (lesson) timetableActions.saveLesson(slot, lesson);
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
      <h3 className={styles.heading}>בחירת מקצוע מתבנית</h3>
      <PresetPicker
        presets={presets}
        selected={draft.empty ? EMPTY_PRESET : draft.presetId}
        onSelectPreset={(p) => setDraft(draftFromPreset(p))}
        onSelectEmpty={() => setDraft(EMPTY_DRAFT)}
      />

      <h3 className={styles.heading}>תצוגה מקדימה</h3>
      <div className={styles.preview}>
        {draft.empty ? (
          <p className={styles.emptyPreview}>שעה ריקה</p>
        ) : (
          <LessonCard
            lesson={{ ...draft, id: 'preview', subject: draft.subject || 'מקצוע', color: errors.color ? '#999a9d' : draft.color }}
          />
        )}
      </div>

      <h3 className={styles.heading}>פרטי השיעור</h3>
      {preset && custom.length > 0 && (
        <div className={styles.customNote}>
          <span>
            מותאם אישית — שונה מהתבנית „{preset.name}” ב: {custom.map((f) => FIELD_LABELS[f]).join(', ')}. התבנית עצמה לא
            משתנה.
          </span>
          <Button variant="ghost" onClick={() => setDraft(draftFromPreset(preset))}>
            החזרה לערכי התבנית
          </Button>
        </div>
      )}
      <TextField
        label="מקצוע"
        value={draft.empty ? '' : draft.subject}
        onValueChange={(v) => setField('subject', v)}
        error={showErrors ? errors.subject : undefined}
        placeholder={draft.empty ? 'שעה ריקה — הקלדה תיצור שיעור' : undefined}
        maxLength={80}
      />
      <TextField label="מורה" value={draft.empty ? '' : draft.teacher} onValueChange={(v) => setField('teacher', v)} maxLength={80} />
      <TextField
        label="חדר"
        value={draft.empty ? '' : draft.room}
        onValueChange={(v) => setField('room', v)}
        hint="יוצג כ„חדר: …”. השאירו ריק כדי להסתיר את השורה."
        maxLength={80}
      />
      {!draft.empty && (
        <ColorPicker label="צבע" value={draft.color} swatches={COLOR_SWATCHES} onChange={(c) => setField('color', c)} />
      )}

      {saved && <SavedLessonActions timetable={timetable} slot={slot} saved={saved} onDone={onClose} />}
    </Modal>
  );
}

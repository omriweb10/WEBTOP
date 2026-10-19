import { useState } from 'react';
import { Button } from '../../../../components/ui/Button';
import { ColorPicker } from '../../../../components/ui/ColorPicker';
import { TextAreaField, TextField } from '../../../../components/ui/fields';
import { Modal } from '../../../../components/ui/Modal';
import { COLOR_SWATCHES } from '../../../../data/subjectPalette';
import { LessonCard } from '../../../timetable/components/LessonCard';
import type { PresetFields } from '../../api/types';
import { cleanPreset, PRESET_LIMITS, validatePreset } from '../../domain/presetForm';
import styles from './presets.module.css';

interface PresetEditorProps {
  title: string;
  initial: PresetFields;
  /** Saves; resolves to an error message or null. */
  onSave: (fields: PresetFields) => Promise<string | null>;
  onClose: () => void;
}

/** Create/edit form for a subject preset with a live lesson-card preview. */
export function PresetEditor({ title, initial, onSave, onClose }: PresetEditorProps) {
  const [fields, setFields] = useState(initial);
  const [showErrors, setShowErrors] = useState(false);
  const [busy, setBusy] = useState(false);
  const [failure, setFailure] = useState<string | null>(null);
  const errors = validatePreset(fields);
  const shown = showErrors ? errors : {};

  /** Updates one field. */
  const set = (key: keyof PresetFields) => (value: string) => setFields((current) => ({ ...current, [key]: value }));

  /** Validates and saves. */
  const save = async () => {
    if (Object.keys(errors).length > 0) {
      setShowErrors(true);
      return;
    }
    setBusy(true);
    const problem = await onSave(cleanPreset(fields));
    setBusy(false);
    if (problem) setFailure(problem);
    else onClose();
  };

  return (
    <Modal
      open
      title={title}
      onClose={onClose}
      footer={
        <>
          <Button variant="primary" disabled={busy} onClick={() => void save()}>
            {busy ? 'שומר…' : 'שמירה'}
          </Button>
          <Button variant="secondary" disabled={busy} onClick={onClose}>
            ביטול
          </Button>
        </>
      }
    >
      <div className={styles.preview}>
        <LessonCard
          lesson={{
            id: 'preview',
            presetId: null,
            subject: fields.name.trim() || 'שם המקצוע',
            teacher: fields.teacher,
            room: fields.room,
            color: errors.color ? '#999a9d' : fields.color,
          }}
        />
      </div>
      <TextField label="שם המקצוע (כפי שיוצג בכרטיס) *" value={fields.name} onValueChange={set('name')} maxLength={PRESET_LIMITS.name} error={shown.name} />
      <TextField label="שם קצר (לתפריט הבחירה, רשות)" value={fields.short_name} onValueChange={set('short_name')} maxLength={PRESET_LIMITS.short_name} error={shown.short_name} />
      <TextField label="מורה" value={fields.teacher} onValueChange={set('teacher')} maxLength={PRESET_LIMITS.teacher} error={shown.teacher} />
      <TextField label="חדר" value={fields.room} onValueChange={set('room')} maxLength={PRESET_LIMITS.room} error={shown.room} />
      <ColorPicker label="צבע" value={fields.color} swatches={COLOR_SWATCHES} onChange={set('color')} />
      <TextAreaField label="הערות (רשות)" value={fields.notes} onValueChange={set('notes')} maxLength={PRESET_LIMITS.notes} error={shown.notes} />
      {failure && (
        <p className={styles.failure} role="alert">
          {failure}
        </p>
      )}
    </Modal>
  );
}

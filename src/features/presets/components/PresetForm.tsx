import { useState } from 'react';
import { Button } from '../../../components/ui/Button';
import { ColorPicker } from '../../../components/ui/ColorPicker';
import { confirm } from '../../../components/ui/confirmStore';
import { SelectField, TextField } from '../../../components/ui/fields';
import { Modal } from '../../../components/ui/Modal';
import { COLOR_SWATCHES } from '../../../data/subjectPalette';
import { PresetSchema, type Preset } from '../../../schemas/presets';
import { useTimetableStore } from '../../../store/dataStores';
import { toast } from '../../../store/uiStore';
import { createId } from '../../../utils/id';
import { LessonCard } from '../../timetable/components/LessonCard';
import { countLessonsUsingPreset } from '../domain/presetOps';
import { presetActions, type PresetApplyMode } from '../presetActions';

type FieldErrors = Partial<Record<keyof Preset, string>>;

interface PresetFormProps {
  /** Preset to edit, or 'new' to create one. */
  target: Preset | 'new';
  onClose: () => void;
}

/** Blank preset used for "new". */
function newPreset(): Preset {
  return { id: createId('preset'), name: '', subject: '', teacher: '', room: '', color: COLOR_SWATCHES[0] ?? '#999a9d' };
}

/**
 * Create/edit a subject preset. When the preset is already used by lessons the user
 * explicitly chooses whether (and how) to propagate the change, then confirms.
 * Mounted only while open, so the form starts from the target preset.
 */
export function PresetForm({ target, onClose }: PresetFormProps) {
  const timetable = useTimetableStore((state) => state.value);
  const [preset, setPreset] = useState<Preset>(() => (target === 'new' ? newPreset() : target));
  const [apply, setApply] = useState<PresetApplyMode>('none');
  const [errors, setErrors] = useState<FieldErrors>({});
  const isNew = target === 'new';
  const usage = isNew ? 0 : countLessonsUsingPreset(timetable, preset.id);

  /** Updates one field and clears its error. */
  const set = <K extends keyof Preset>(key: K, value: Preset[K]) => {
    setPreset({ ...preset, [key]: value });
    setErrors((e) => ({ ...e, [key]: undefined }));
  };

  /** Validates, confirms propagation if requested, and saves. */
  const save = async () => {
    const candidate = { ...preset, name: preset.name.trim(), subject: preset.subject.trim(), teacher: preset.teacher.trim(), room: preset.room.trim() };
    const result = PresetSchema.safeParse(candidate);
    if (!result.success) {
      const next: FieldErrors = {};
      for (const issue of result.error.issues) {
        const key = issue.path[0] as keyof Preset;
        next[key] ??= issue.code === 'too_small' ? 'שדה חובה' : issue.message;
      }
      setErrors(next);
      return;
    }
    if (apply !== 'none') {
      const ok = await confirm({
        title: 'עדכון שיעורים קיימים',
        message:
          apply === 'overwrite'
            ? `לעדכן ${usage} שיעורים לפי התבנית, כולל דריסת שדות שנערכו ידנית?`
            : `לעדכן ${usage} שיעורים לפי התבנית? שדות שנערכו ידנית בשיעור מסוים יישארו כפי שהם.`,
        confirmLabel: 'עדכון',
      });
      if (!ok) return;
    }
    presetActions.save(result.data, apply);
    toast(apply === 'none' ? 'התבנית נשמרה' : `התבנית נשמרה ו־${usage} שיעורים עודכנו`, { tone: 'success' });
    onClose();
  };

  return (
    <Modal
      open
      title={isNew ? 'תבנית מקצוע חדשה' : `עריכת תבנית: ${preset.name}`}
      onClose={onClose}
      footer={
        <>
          <Button variant="primary" onClick={() => void save()}>
            שמירה
          </Button>
          <Button onClick={onClose}>ביטול</Button>
        </>
      }
    >
      <LessonCard lesson={{ id: 'preview', presetId: preset.id, subject: preset.subject || 'מקצוע', teacher: preset.teacher, room: preset.room, color: preset.color }} />
      <div style={{ height: 14 }} />
      <TextField label="שם קצר (לבחירה מהירה)" value={preset.name} onValueChange={(v) => set('name', v)} error={errors.name} maxLength={40} />
      <TextField label="שם המקצוע בכרטיס" value={preset.subject} onValueChange={(v) => set('subject', v)} error={errors.subject} maxLength={80} />
      <TextField label="מורה" value={preset.teacher} onValueChange={(v) => set('teacher', v)} error={errors.teacher} maxLength={80} />
      <TextField label="חדר" value={preset.room} onValueChange={(v) => set('room', v)} error={errors.room} maxLength={80} />
      <ColorPicker label="צבע" value={preset.color} swatches={COLOR_SWATCHES} onChange={(c) => set('color', c)} />
      {usage > 0 && (
        <SelectField
          label={`החלה על ${usage} שיעורים שמשתמשים בתבנית`}
          value={apply}
          onValueChange={setApply}
          options={[
            { value: 'none', label: 'לא — לשנות רק את התבנית' },
            { value: 'keep-custom', label: 'כן — לעדכן שיעורים (לשמור עריכות ידניות)' },
            { value: 'overwrite', label: 'כן — לעדכן ולדרוס גם עריכות ידניות' },
          ]}
          hint="שינוי תבנית לעולם לא משנה שיעורים בלי בחירה מפורשת כאן."
        />
      )}
    </Modal>
  );
}

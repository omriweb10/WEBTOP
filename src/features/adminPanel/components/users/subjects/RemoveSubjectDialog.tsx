import { useState } from 'react';
import { Button } from '../../../../../components/ui/Button';
import { SelectField } from '../../../../../components/ui/fields';
import { Modal } from '../../../../../components/ui/Modal';
import { toast } from '../../../../../store/uiStore';
import { cx } from '../../../../../utils/classNames';
import { removePreset, setPresetArchived } from '../../../api/presetsApi';
import type { PresetRow, UserOverview } from '../../../api/types';
import { errorMessage } from '../../../domain/adminErrors';
import { lessonUsageLabel } from '../../../domain/formatters';
import { canConfirmRemoval, lessonsOption, replacementOptions, type RemovalChoice } from '../../../domain/presetRemoval';
import presetStyles from '../../presets/presets.module.css';

interface RemoveSubjectDialogProps {
  user: UserOverview;
  preset: PresetRow;
  /** The student's whole list (for choosing a replacement). */
  presets: readonly PresetRow[];
  onClose: () => void;
  onDone: () => void;
}

/**
 * Removes a subject from one student. When it is still placed in their timetable the admin
 * must choose first: move those lessons to another subject, empty those periods, or only
 * hide the subject. Nothing is deleted silently.
 */
export function RemoveSubjectDialog({ user, preset, presets, onClose, onDone }: RemoveSubjectDialogProps) {
  const [choice, setChoice] = useState<RemovalChoice | null>(null);
  const replacements = replacementOptions(presets, preset);
  const [replacementId, setReplacementId] = useState('');
  const [busy, setBusy] = useState(false);
  const used = preset.lesson_count > 0;
  const name = user.display_name;

  /** Applies the choice. */
  const confirmRemoval = async () => {
    setBusy(true);
    try {
      if (choice === 'hide') {
        await setPresetArchived(preset.id, true);
        toast(`„${preset.name}” הוסתר מהבחירה. השיעורים הקיימים נשארו.`, { tone: 'success' });
      } else {
        await removePreset(preset.id, lessonsOption(preset, choice, replacementId));
        toast(
          choice === 'replace' ? `„${preset.name}” הוסר והשיעורים שלו הוחלפו` : choice === 'delete' ? `„${preset.name}” והשיעורים שלו הוסרו` : `„${preset.name}” הוסר`,
          { tone: 'success' },
        );
      }
      onDone();
    } catch (error) {
      toast(errorMessage(error), { tone: 'error', duration: 7000 });
      setBusy(false);
    }
  };

  /** One radio option. */
  const option = (value: RemovalChoice, label: string, hint: string, disabled = false) => (
    <label className={cx(presetStyles.choice, disabled && presetStyles.choiceDisabled)}>
      <input type="radio" name="removal" value={value} checked={choice === value} disabled={disabled} onChange={() => setChoice(value)} />
      <span className={presetStyles.choiceText}>
        <span className={presetStyles.choiceLabel}>{label}</span>
        <span className={presetStyles.choiceHint}>{hint}</span>
      </span>
    </label>
  );

  return (
    <Modal
      open
      variant={used ? 'sheet' : 'dialog'}
      title={`הסרת „${preset.name}”`}
      onClose={onClose}
      footer={
        <>
          <Button variant={choice === 'hide' ? 'primary' : 'danger'} disabled={busy || !canConfirmRemoval(preset, choice, replacementId)} onClick={() => void confirmRemoval()}>
            {choice === 'hide' ? 'הסתרה' : 'הסרה'}
          </Button>
          <Button variant="secondary" disabled={busy} onClick={onClose}>
            ביטול
          </Button>
        </>
      }
    >
      {!used ? (
        <p className={presetStyles.note}>
          להסיר את „{preset.name}” מהמקצועות של {name}? הוא אינו משובץ במערכת השעות שלו/ה. משתמשים אחרים לא יושפעו.
        </p>
      ) : (
        <>
          <p className={presetStyles.warning} role="alert">
            „{preset.name}” {lessonUsageLabel(preset.lesson_count)} במערכת השעות של {name}. בחרו מה לעשות בשיעורים האלה:
          </p>
          <fieldset className={presetStyles.choices}>
            <legend className="visually-hidden">מה לעשות בשיעורים</legend>
            {option(
              'replace',
              'להחליף אותם במקצוע אחר',
              replacements.length > 0 ? 'השיעורים יישארו באותן שעות, עם המקצוע שתבחרו.' : `אין ל${name} מקצוע פעיל אחר להחלפה.`,
              replacements.length === 0,
            )}
            {choice === 'replace' && (
              <SelectField
                label="מקצוע חלופי"
                value={replacementId}
                options={[{ value: '', label: 'בחרו מקצוע…' }, ...replacements.map((p) => ({ value: p.id, label: p.name }))]}
                onValueChange={setReplacementId}
              />
            )}
            {option('delete', 'למחוק גם את השיעורים', 'השעות האלה יתרוקנו במערכת של ' + name + '.')}
            {option('hide', 'לא להסיר — רק להסתיר מהבחירה', 'השיעורים הקיימים נשארים; אי אפשר לשבץ את המקצוע מחדש עד שיוחזר.')}
          </fieldset>
        </>
      )}
    </Modal>
  );
}

import { useState } from 'react';
import { Button } from '../../../../components/ui/Button';
import { SelectField } from '../../../../components/ui/fields';
import { Modal } from '../../../../components/ui/Modal';
import type { Preset } from '../../../../schemas/presets';
import type { DayId, Timetable } from '../../../../schemas/timetable';
import { lessonFromPreset } from '../../../presets/domain/presetOps';
import { EMPTY_PRESET, PresetPicker } from '../../../presets/components/PresetPicker';
import { DAYS, getDayInfo } from '../../../timetable/domain/days';
import { formatPeriodLabel, formatPeriodRange } from '../../../timetable/domain/periods';
import { copyLesson, getLesson, moveLesson, sameSlot, setLesson, type ConflictMode, type Slot } from '../../../timetable/domain/timetableOps';
import { LessonCard } from '../../../timetable/components/LessonCard';
import styles from './schedule.module.css';

interface CellSheetProps {
  timetable: Timetable;
  slot: Slot;
  presets: readonly Preset[];
  onChange: (next: Timetable) => void;
  onClose: () => void;
}

/** Edits one cell: choose a subject or an empty period, or move/copy the lesson elsewhere. */
export function CellSheet({ timetable, slot, presets, onChange, onClose }: CellSheetProps) {
  const current = getLesson(timetable, slot);
  const [selected, setSelected] = useState<string>(current?.presetId ?? EMPTY_PRESET);
  const [targetDay, setTargetDay] = useState<DayId>(slot.day);
  const [targetIndex, setTargetIndex] = useState(String(Math.min(slot.index + 1, timetable.periods.length - 1)));
  const [conflict, setConflict] = useState<ConflictMode>('swap');

  const preset = presets.find((p) => p.id === selected);
  const period = timetable.periods[slot.index];
  const target: Slot = { day: targetDay, index: Number(targetIndex) };
  const occupant = getLesson(timetable, target);

  /** Saves the chosen subject or empties the cell. */
  const apply = () => {
    if (selected === current?.presetId) return onClose();
    onChange(setLesson(timetable, slot, preset ? lessonFromPreset(preset, current?.id) : null));
    onClose();
  };

  /** Moves or copies the current lesson to the chosen target. */
  const relocate = (mode: 'move' | 'copy') => {
    if (sameSlot(slot, target)) return;
    onChange(mode === 'move' ? moveLesson(timetable, slot, target, conflict) : copyLesson(timetable, slot, target));
    onClose();
  };

  return (
    <Modal
      open
      title={`${getDayInfo(slot.day).name} · שעה ${slot.index + 1}${period ? ` (${formatPeriodRange(period)})` : ''}`}
      onClose={onClose}
      footer={
        <>
          <Button variant="primary" onClick={apply}>
            החלה
          </Button>
          <Button variant="secondary" onClick={onClose}>
            ביטול
          </Button>
        </>
      }
    >
      <h3 className={styles.sheetHeading}>מקצוע</h3>
      <PresetPicker presets={presets} selected={preset ? preset.id : EMPTY_PRESET} onSelectPreset={(p) => setSelected(p.id)} onSelectEmpty={() => setSelected(EMPTY_PRESET)} />
      <h3 className={styles.sheetHeading}>תצוגה מקדימה</h3>
      <div className={styles.sheetPreview}>{preset ? <LessonCard lesson={lessonFromPreset(preset, 'preview')} /> : <p className={styles.muted}>שעה ריקה</p>}</div>

      {current && (
        <>
          <h3 className={styles.sheetHeading}>העברה או העתקה של „{current.subject}”</h3>
          <div className={styles.targetRow}>
            <SelectField label="יום" value={targetDay} options={DAYS.map((d) => ({ value: d.id, label: d.name }))} onValueChange={setTargetDay} />
            <SelectField
              label="שעה"
              value={targetIndex}
              options={timetable.periods.map((p, i) => ({ value: String(i), label: formatPeriodLabel(p) }))}
              onValueChange={setTargetIndex}
            />
          </div>
          {occupant && !sameSlot(slot, target) && (
            <SelectField
              label={`ביעד כבר יש „${occupant.subject}”. בהעברה:`}
              value={conflict}
              options={[
                { value: 'swap', label: 'להחליף ביניהם' },
                { value: 'replace', label: 'לדרוס את השיעור ביעד' },
              ]}
              onValueChange={setConflict}
            />
          )}
          <div className={styles.sheetActions}>
            <Button icon="move" disabled={sameSlot(slot, target)} onClick={() => relocate('move')}>
              העברה
            </Button>
            <Button icon="copy" disabled={sameSlot(slot, target)} onClick={() => relocate('copy')}>
              העתקה
            </Button>
          </div>
        </>
      )}
    </Modal>
  );
}

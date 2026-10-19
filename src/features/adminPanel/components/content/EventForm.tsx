import { useState } from 'react';
import { Button } from '../../../../components/ui/Button';
import { SelectField, TextAreaField, TextField } from '../../../../components/ui/fields';
import { Modal } from '../../../../components/ui/Modal';
import { normalizeTime, toTwoDigitTime } from '../../../../utils/time';
import type { EventInput } from '../../api/contentApi';
import type { EventRow, UserOverview } from '../../api/types';
import { AudienceSelect } from './AudienceSelect';

interface EventFormProps {
  initial: EventRow | null;
  users: readonly UserOverview[];
  onSave: (input: EventInput) => Promise<string | null>;
  onClose: () => void;
}

/** Create/edit an exam or event. */
export function EventForm({ initial, users, onSave, onClose }: EventFormProps) {
  const [input, setInput] = useState<EventInput>(
    initial
      ? { profile_id: initial.profile_id, kind: initial.kind, title: initial.title, date: initial.date, time: initial.time, group_name: initial.group_name, notes: initial.notes }
      : { profile_id: null, kind: 'exam', title: '', date: new Date().toISOString().slice(0, 10), time: null, group_name: '', notes: '' },
  );
  const [failure, setFailure] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  /** Saves when valid. */
  const save = async () => {
    if (!input.title.trim()) return setFailure('יש להזין כותרת');
    if (!/^\d{4}-\d{2}-\d{2}$/.test(input.date)) return setFailure('יש לבחור תאריך');
    setBusy(true);
    const problem = await onSave({ ...input, title: input.title.trim(), group_name: input.group_name.trim(), notes: input.notes.trim() });
    setBusy(false);
    if (problem) setFailure(problem);
    else onClose();
  };

  return (
    <Modal
      open
      title={initial ? 'עריכת אירוע' : 'אירוע או מבחן חדש'}
      onClose={onClose}
      footer={
        <>
          <Button variant="primary" disabled={busy} onClick={() => void save()}>
            שמירה
          </Button>
          <Button variant="secondary" onClick={onClose}>
            ביטול
          </Button>
        </>
      }
    >
      <SelectField
        label="סוג"
        value={input.kind}
        options={[
          { value: 'exam', label: 'מבחן' },
          { value: 'event', label: 'אירוע' },
        ]}
        onValueChange={(kind) => setInput({ ...input, kind })}
      />
      <TextField label="כותרת *" value={input.title} onValueChange={(title) => setInput({ ...input, title })} maxLength={120} />
      <TextField label="תאריך *" type="date" value={input.date} onValueChange={(date) => setInput({ ...input, date })} />
      <TextField
        label="שעה (רשות)"
        type="time"
        value={input.time ? toTwoDigitTime(input.time) : ''}
        onValueChange={(time) => setInput({ ...input, time: time ? normalizeTime(time) : null })}
      />
      <TextField label="קבוצה (רשות)" value={input.group_name} onValueChange={(group_name) => setInput({ ...input, group_name })} maxLength={80} />
      <TextAreaField label="הערות" value={input.notes} onValueChange={(notes) => setInput({ ...input, notes })} maxLength={2000} />
      <AudienceSelect users={users} value={input.profile_id} onChange={(profile_id) => setInput({ ...input, profile_id })} />
      {failure && <p role="alert">{failure}</p>}
    </Modal>
  );
}

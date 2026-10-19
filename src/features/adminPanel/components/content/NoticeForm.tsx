import { useState } from 'react';
import { Button } from '../../../../components/ui/Button';
import { SelectField, TextAreaField, TextField } from '../../../../components/ui/fields';
import { Modal } from '../../../../components/ui/Modal';
import type { NotificationInput } from '../../api/contentApi';
import type { NotificationRow, UserOverview } from '../../api/types';
import { AudienceSelect } from './AudienceSelect';

interface NoticeFormProps {
  initial: NotificationRow | null;
  users: readonly UserOverview[];
  onSave: (input: NotificationInput) => Promise<string | null>;
  onClose: () => void;
}

/** Create/edit a notice ("שינויי מערכת" or a general message). */
export function NoticeForm({ initial, users, onSave, onClose }: NoticeFormProps) {
  const [input, setInput] = useState<NotificationInput>(
    initial
      ? { profile_id: initial.profile_id, category: initial.category, title: initial.title, body: initial.body, date: initial.date }
      : { profile_id: null, category: 'general', title: '', body: '', date: null },
  );
  const [failure, setFailure] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const titleError = input.title.trim() ? undefined : 'יש להזין כותרת';

  /** Saves when valid. */
  const save = async () => {
    if (titleError) return setFailure(titleError);
    setBusy(true);
    const problem = await onSave({ ...input, title: input.title.trim(), body: input.body.trim() });
    setBusy(false);
    if (problem) setFailure(problem);
    else onClose();
  };

  return (
    <Modal
      open
      title={initial ? 'עריכת הודעה' : 'הודעה חדשה'}
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
        value={input.category}
        options={[
          { value: 'general', label: 'הודעה כללית' },
          { value: 'change', label: 'שינוי מערכת' },
        ]}
        onValueChange={(category) => setInput({ ...input, category })}
      />
      <TextField label="כותרת *" value={input.title} onValueChange={(title) => setInput({ ...input, title })} maxLength={120} />
      <TextAreaField label="תוכן" value={input.body} onValueChange={(body) => setInput({ ...input, body })} maxLength={2000} />
      <TextField label="תאריך (רשות)" type="date" value={input.date ?? ''} onValueChange={(date) => setInput({ ...input, date: date || null })} />
      <AudienceSelect users={users} value={input.profile_id} onChange={(profile_id) => setInput({ ...input, profile_id })} />
      {failure && <p role="alert">{failure}</p>}
    </Modal>
  );
}

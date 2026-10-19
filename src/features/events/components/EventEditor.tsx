import { useState } from 'react';
import { Button } from '../../../components/ui/Button';
import { SelectField, TextAreaField, TextField } from '../../../components/ui/fields';
import { Modal } from '../../../components/ui/Modal';
import { SchoolEventSchema, type EventKind, type SchoolEvent } from '../../../schemas/content';
import { toIsoDate } from '../../../utils/dates';
import { createId } from '../../../utils/id';
import { toTwoDigitTime } from '../../../utils/time';
import { EVENT_KIND_LABELS } from '../domain/eventOps';
import { eventActions } from '../eventActions';

interface EventEditorProps {
  /** Event to edit, or a kind to create. */
  target: { event: SchoolEvent } | { kind: EventKind };
  /** Suggested class/study-group names for the group field. */
  groups: readonly string[];
  onClose: () => void;
}

/** Builds the initial form state for the editor target. */
function initialEvent(target: EventEditorProps['target']): SchoolEvent {
  if ('event' in target) return target.event;
  return { id: createId('evt'), kind: target.kind, title: '', date: toIsoDate(new Date()), time: null, group: '', notes: '' };
}

/** Create/edit form for a local exam or event (mounted only while open), validated with SchoolEventSchema. */
export function EventEditor({ target, groups, onClose }: EventEditorProps) {
  const [event, setEvent] = useState<SchoolEvent>(() => initialEvent(target));
  const [errors, setErrors] = useState<Partial<Record<'title' | 'date' | 'time', string>>>({});
  const isNew = !('event' in target);

  /** Validates and persists the item. */
  const save = () => {
    const result = SchoolEventSchema.safeParse({ ...event, title: event.title.trim(), notes: event.notes.trim() });
    if (!result.success) {
      const next: typeof errors = {};
      for (const issue of result.error.issues) {
        const field = issue.path[0];
        if (field === 'title') next.title = 'יש להזין כותרת';
        if (field === 'date') next.date = 'יש לבחור תאריך תקין';
        if (field === 'time') next.time = 'שעה לא תקינה';
      }
      setErrors(next);
      return;
    }
    eventActions.save(result.data);
    onClose();
  };

  return (
    <Modal
      open
      title={isNew ? `${EVENT_KIND_LABELS[event.kind]} חדש` : `עריכת ${EVENT_KIND_LABELS[event.kind]}`}
      onClose={onClose}
      footer={
        <>
          <Button variant="primary" onClick={save}>
            שמירה
          </Button>
          <Button onClick={onClose}>ביטול</Button>
        </>
      }
    >
      <SelectField
        label="סוג"
        value={event.kind}
        options={(Object.keys(EVENT_KIND_LABELS) as EventKind[]).map((k) => ({ value: k, label: EVENT_KIND_LABELS[k] }))}
        onValueChange={(kind) => setEvent({ ...event, kind })}
      />
      <TextField label="כותרת" value={event.title} onValueChange={(title) => setEvent({ ...event, title })} error={errors.title} maxLength={120} />
      <TextField label="תאריך" type="date" value={event.date} onValueChange={(date) => setEvent({ ...event, date })} error={errors.date} />
      <TextField
        label="שעה (לא חובה)"
        type="time"
        value={event.time ? toTwoDigitTime(event.time) : ''}
        onValueChange={(time) => setEvent({ ...event, time: time || null })}
        error={errors.time}
      />
      <SelectField
        label="כיתה / קבוצת לימוד"
        value={event.group}
        options={[{ value: '', label: 'כל הכיתה' }, ...groups.map((g) => ({ value: g, label: g }))]}
        onValueChange={(group) => setEvent({ ...event, group })}
      />
      <TextAreaField label="הערות" value={event.notes} onValueChange={(notes) => setEvent({ ...event, notes })} maxLength={2000} />
    </Modal>
  );
}

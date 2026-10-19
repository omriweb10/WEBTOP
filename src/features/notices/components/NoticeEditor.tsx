import { useState } from 'react';
import { Button } from '../../../components/ui/Button';
import { SelectField, TextAreaField, TextField } from '../../../components/ui/fields';
import { Modal } from '../../../components/ui/Modal';
import { NoticeSchema, type Notice, type NoticeCategory } from '../../../schemas/content';
import { createId } from '../../../utils/id';
import { NOTICE_CATEGORY_LABELS } from '../domain/noticeOps';
import { noticeActions } from '../noticeActions';

interface NoticeEditorProps {
  /** Notice to edit, or a category to create a new one in. */
  target: { notice: Notice } | { category: NoticeCategory };
  onClose: () => void;
}

/** Builds the initial form state for the editor target. */
function initialNotice(target: NoticeEditorProps['target']): Notice {
  if ('notice' in target) return target.notice;
  return { id: createId('ntc'), category: target.category, title: '', body: '', date: null, createdAt: new Date().toISOString() };
}

/** Create/edit form for a local notice (mounted only while open), validated with NoticeSchema. */
export function NoticeEditor({ target, onClose }: NoticeEditorProps) {
  const [notice, setNotice] = useState<Notice>(() => initialNotice(target));
  const [error, setError] = useState<string | undefined>();
  const isNew = !('notice' in target);

  /** Validates and persists the notice. */
  const save = () => {
    const result = NoticeSchema.safeParse({ ...notice, title: notice.title.trim(), body: notice.body.trim() });
    if (!result.success) {
      setError(result.error.issues.some((i) => i.path[0] === 'title') ? 'יש להזין כותרת' : 'יש לבדוק את השדות');
      return;
    }
    noticeActions.save(result.data);
    onClose();
  };

  return (
    <Modal
      open
      title={isNew ? 'הודעה חדשה' : 'עריכת הודעה'}
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
        value={notice.category}
        options={(Object.keys(NOTICE_CATEGORY_LABELS) as NoticeCategory[]).map((c) => ({ value: c, label: NOTICE_CATEGORY_LABELS[c] }))}
        onValueChange={(category) => setNotice({ ...notice, category })}
      />
      <TextField
        label="כותרת"
        value={notice.title}
        onValueChange={(title) => {
          setNotice({ ...notice, title });
          setError(undefined);
        }}
        error={error}
        maxLength={120}
      />
      <TextField
        label="תאריך (לא חובה)"
        type="date"
        value={notice.date ?? ''}
        onValueChange={(date) => setNotice({ ...notice, date: date || null })}
        hint="שינויי מערכת עם תאריך יוצגו מעל מערכת השעות כשהתראות השינויים פעילות."
      />
      <TextAreaField label="פירוט" value={notice.body} onValueChange={(body) => setNotice({ ...notice, body })} maxLength={2000} />
    </Modal>
  );
}

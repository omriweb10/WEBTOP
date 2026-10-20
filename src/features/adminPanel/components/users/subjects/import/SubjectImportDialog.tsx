import { useMemo, useState } from 'react';
import { Button } from '../../../../../../components/ui/Button';
import { Icon } from '../../../../../../components/ui/Icon';
import { Modal } from '../../../../../../components/ui/Modal';
import { toast } from '../../../../../../store/uiStore';
import { importSubjects, importSuccessMessage, PartialImportError } from '../../../../actions/importSubjects';
import type { PresetRow, UserOverview } from '../../../../api/types';
import { errorMessage } from '../../../../domain/adminErrors';
import { COLOR_NAME_LIST } from '../../../../domain/subjectImport/colorNames';
import { countPlan, planImport } from '../../../../domain/subjectImport/importPlan';
import { parseSubjectText } from '../../../../domain/subjectImport/parseSubjects';
import { DuplicateChoice } from './DuplicateChoice';
import { ImportIssues } from './ImportIssues';
import { ImportSummary } from './ImportSummary';
import { NotepadEditor } from './NotepadEditor';
import styles from './subjectImport.module.css';

const EXAMPLE = `מקצוע : מתמטיקה
שם מורה : ישראל כהן
חדר : 201
צבע : #1498FD

מקצוע : אנגלית
שם מורה : דנה לוי
חדר : 104
צבע : אפור`;

interface SubjectImportDialogProps {
  /** The student whose list receives the subjects (and only that student). */
  user: UserOverview;
  /** That student's current subjects, for duplicate detection. */
  presets: readonly PresetRow[];
  onClose: () => void;
  /** The student's list changed (refresh it). */
  onImported: () => void;
}

/**
 * "ייבוא מקצועות מטקסט": paste subjects as plain text; they are parsed and checked as you
 * type, compared with the student's existing subjects, and created for this student with
 * one click. Problems are listed and the text stays for correcting.
 */
export function SubjectImportDialog({ user, presets, onClose, onImported }: SubjectImportDialogProps) {
  const [text, setText] = useState('');
  const [updateConflicts, setUpdateConflicts] = useState(false);
  const [busy, setBusy] = useState(false);
  const [failure, setFailure] = useState<string | null>(null);

  const parsed = useMemo(() => parseSubjectText(text), [text]);
  const plan = useMemo(() => planImport(parsed.subjects, presets), [parsed, presets]);
  const counts = countPlan(plan, updateConflicts);
  const conflicts = plan.filter((item) => item.kind === 'conflict');
  const identical = plan.filter((item) => item.kind === 'identical').length;
  const hasText = parsed.blockCount > 0;
  const ready = hasText && parsed.issues.length === 0 && counts.create + counts.update > 0;
  const name = user.display_name;

  /** Creates (and, if chosen, updates) the subjects for this student. */
  const submit = async () => {
    setBusy(true);
    setFailure(null);
    try {
      const outcome = await importSubjects(user.id, plan, updateConflicts);
      toast(importSuccessMessage(outcome), { tone: 'success' });
      onImported();
      onClose();
    } catch (error) {
      setFailure(errorMessage(error));
      if (error instanceof PartialImportError) onImported();
    } finally {
      setBusy(false);
    }
  };

  return (
    <Modal
      open
      title="ייבוא מקצועות מטקסט"
      onClose={busy ? () => undefined : onClose}
      className={styles.wide}
      footer={
        <>
          <Button variant="primary" disabled={!ready || busy} aria-busy={busy} onClick={() => void submit()}>
            {busy ? (
              <>
                <span className={styles.spinner} aria-hidden="true" /> יוצר מקצועות…
              </>
            ) : (
              'צור מקצועות'
            )}
          </Button>
          <Button variant="secondary" disabled={busy} onClick={onClose}>
            ביטול
          </Button>
        </>
      }
    >
      <p className={styles.target}>
        <Icon name="person" size={20} className={styles.targetIcon} />
        <span>
          המקצועות יתווספו רק ל<strong>{name}</strong>
          {user.class_name ? ` (${user.class_name})` : ''}.
        </span>
      </p>
      <NotepadEditor value={text} onChange={setText} label="טקסט המקצועות" placeholder={EXAMPLE} disabled={busy} />
      <p className={styles.hint}>
        בכל מקצוע ארבע שורות — מקצוע, שם מורה, חדר, צבע — ושורה ריקה בין מקצועות. צבע: {'\u200e'}#RRGGBB או {COLOR_NAME_LIST.join(', ')}.
      </p>
      {hasText && <ImportSummary found={parsed.blockCount} valid={parsed.subjects.length} counts={counts} />}
      {identical > 0 && (
        <p className={styles.muted}>
          {identical === 1 ? 'מקצוע אחד כבר קיים' : `${identical} מקצועות כבר קיימים`} אצל {name} עם אותם פרטים וידולגו.
        </p>
      )}
      <ImportIssues issues={parsed.issues} />
      {parsed.issues.length === 0 && (
        <DuplicateChoice conflicts={conflicts} update={updateConflicts} onChange={setUpdateConflicts} studentName={name} />
      )}
      {failure && (
        <p className={styles.failure} role="alert">
          {failure}
        </p>
      )}
    </Modal>
  );
}

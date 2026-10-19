import { useEffect, useState } from 'react';
import { Button } from '../../../../components/ui/Button';
import { Modal } from '../../../../components/ui/Modal';
import { toast } from '../../../../store/uiStore';
import { assignTemplate, previewAssignment } from '../../api/templatesApi';
import type { TemplateRow } from '../../api/types';
import { errorMessage } from '../../domain/adminErrors';
import { useUsers } from '../../state/resources';
import { reloadUserPresets } from '../../state/userPresets';
import { LoadingView } from '../shared/StatusViews';
import { UserPicker } from '../shared/UserPicker';
import styles from './templates.module.css';

type Step = { kind: 'pick' } | { kind: 'confirm'; customized: Array<{ id: string; display_name: string }> };

/**
 * Assigns a template to one or many students. Students who customised their timetable are
 * listed first, and are only overwritten when the admin explicitly chooses so.
 */
export function AssignTemplateDialog({ template, onClose }: { template: TemplateRow; onClose: () => void }) {
  const { data: users, load } = useUsers();
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [step, setStep] = useState<Step>({ kind: 'pick' });
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    void load();
  }, [load]);

  /** Looks up customised timetables among the selection. */
  const next = async () => {
    setBusy(true);
    try {
      setStep({ kind: 'confirm', customized: await previewAssignment(template.id, [...selected]) });
    } catch (error) {
      toast(errorMessage(error), { tone: 'error' });
    } finally {
      setBusy(false);
    }
  };

  /** Assigns, overwriting customised timetables only when asked to. */
  const assign = async (overwrite: boolean) => {
    setBusy(true);
    try {
      const result = await assignTemplate(template.id, [...selected], overwrite);
      reloadUserPresets(result.assigned);
      const skipped = result.skipped_customized.length;
      toast(`התבנית הוחלה על ${result.assigned.length} משתמשים${skipped ? `; ${skipped} עם מערכת מותאמת אישית נשארו ללא שינוי` : ''}.`, {
        tone: 'success',
        duration: 6000,
      });
      void useUsers.getState().load(true);
      onClose();
    } catch (error) {
      toast(errorMessage(error), { tone: 'error' });
    } finally {
      setBusy(false);
    }
  };

  const customized = step.kind === 'confirm' ? step.customized : [];
  return (
    <Modal
      open
      title={`החלת „${template.name}”`}
      onClose={onClose}
      footer={
        step.kind === 'pick' ? (
          <>
            <Button variant="primary" disabled={busy || selected.size === 0} onClick={() => void next()}>
              המשך ({selected.size})
            </Button>
            <Button variant="secondary" onClick={onClose}>
              ביטול
            </Button>
          </>
        ) : customized.length > 0 ? (
          <>
            <Button variant="primary" disabled={busy} onClick={() => void assign(false)}>
              החלה רק על מי שלא שינה ({selected.size - customized.length})
            </Button>
            <Button variant="danger" disabled={busy} onClick={() => void assign(true)}>
              החלה על כולם, כולל דריסת השינויים
            </Button>
            <Button variant="secondary" disabled={busy} onClick={() => setStep({ kind: 'pick' })}>
              חזרה
            </Button>
          </>
        ) : (
          <>
            <Button variant="primary" disabled={busy} onClick={() => void assign(false)}>
              החלה על {selected.size} משתמשים
            </Button>
            <Button variant="secondary" disabled={busy} onClick={() => setStep({ kind: 'pick' })}>
              חזרה
            </Button>
          </>
        )
      }
    >
      {step.kind === 'pick' ? (
        users ? (
          <>
            <p className={styles.note}>התבנית תועתק למערכת האישית של כל משתמש שנבחר, ומקצועות התבנית יתווספו לרשימת המקצועות האישית שלו כעותקים עצמאיים (עותק שכבר קיים אצלו משמש שוב). שינויים עתידיים בתבנית או במאגר לא ישנו אותם.</p>
            <UserPicker users={users} selected={selected} onChange={setSelected} />
          </>
        ) : (
          <LoadingView />
        )
      ) : customized.length > 0 ? (
        <div className={styles.warning} role="alert">
          <p>
            <strong>{customized.length} מהמשתמשים שנבחרו שינו את מערכת השעות שלהם.</strong> החלת התבנית עליהם תמחק את השינויים האלה:
          </p>
          <ul>
            {customized.map((u) => (
              <li key={u.id}>{u.display_name}</li>
            ))}
          </ul>
        </div>
      ) : (
        <p className={styles.note}>לאף אחד מהמשתמשים שנבחרו אין שינויים אישיים. מערכת השעות שלהם תוחלף בתבנית.</p>
      )}
    </Modal>
  );
}

import { useEffect, useState } from 'react';
import { Button } from '../../../../components/ui/Button';
import { confirm } from '../../../../components/ui/confirmStore';
import { toast } from '../../../../store/uiStore';
import { deleteTemplate, duplicateTemplate } from '../../api/templatesApi';
import type { TemplateRow } from '../../api/types';
import { errorMessage } from '../../domain/adminErrors';
import { formatDateTime } from '../../domain/formatters';
import { useTemplates } from '../../state/resources';
import { Page } from '../shared/Page';
import { EmptyView, ErrorView, LoadingView } from '../shared/StatusViews';
import { AssignTemplateDialog } from './AssignTemplateDialog';
import { TemplateEditor } from './TemplateEditor';
import styles from './templates.module.css';

type Editing = { template: TemplateRow | null } | null;

/** Reusable weekly templates: build visually, duplicate, assign to students. */
export function TemplatesSection() {
  const { data, status, error, load } = useTemplates();
  const [editing, setEditing] = useState<Editing>(null);
  const [assigning, setAssigning] = useState<TemplateRow | null>(null);

  useEffect(() => {
    void load();
  }, [load]);

  if (editing) return <TemplateEditor template={editing.template} onDone={() => setEditing(null)} />;

  /** Copies a template under a new name. */
  const duplicate = async (template: TemplateRow) => {
    try {
      await duplicateTemplate(template.id, `${template.name} (עותק)`.slice(0, 60));
      toast('התבנית שוכפלה', { tone: 'success' });
    } catch (failure) {
      toast(errorMessage(failure), { tone: 'error' });
    } finally {
      void load(true);
    }
  };

  /** Deletes after confirmation; students' timetables are unaffected. */
  const remove = async (template: TemplateRow) => {
    const ok = await confirm({
      title: 'מחיקת תבנית',
      message: `למחוק את „${template.name}”? מערכות שכבר הוחלו על תלמידים לא ייפגעו.`,
      confirmLabel: 'מחיקה',
      tone: 'danger',
    });
    if (!ok) return;
    try {
      await deleteTemplate(template.id);
      toast('התבנית נמחקה', { tone: 'success' });
    } catch (failure) {
      toast(errorMessage(failure), { tone: 'error' });
    } finally {
      void load(true);
    }
  };

  return (
    <Page
      title="תבניות מערכת"
      subtitle="בונים פעם אחת, מחילים על תלמיד אחד או על רבים."
      actions={
        <Button icon="add" variant="primary" onClick={() => setEditing({ template: null })}>
          תבנית חדשה
        </Button>
      }
    >
      {status === 'loading' && <LoadingView />}
      {status === 'error' && error && <ErrorView message={error} onRetry={() => void load(true)} />}
      {data && data.length === 0 && <EmptyView text="עדיין אין תבניות." />}
      <ul className={styles.list}>
        {(data ?? []).map((template) => (
          <li key={template.id} className={styles.card}>
            <h2 className={styles.name}>{template.name}</h2>
            <p className={styles.meta}>
              {template.lesson_count} שיעורים · {template.periods.length} שעות ביום · עודכנה {formatDateTime(template.updated_at)}
            </p>
            <div className={styles.actions}>
              <Button icon="edit" onClick={() => setEditing({ template })}>
                עריכה
              </Button>
              <Button icon="assignment" variant="primary" onClick={() => setAssigning(template)}>
                החלה על משתמשים
              </Button>
              <Button icon="copy" onClick={() => void duplicate(template)}>
                שכפול
              </Button>
              <Button icon="delete" variant="danger" onClick={() => void remove(template)}>
                מחיקה
              </Button>
            </div>
          </li>
        ))}
      </ul>
      {assigning && <AssignTemplateDialog template={assigning} onClose={() => setAssigning(null)} />}
    </Page>
  );
}

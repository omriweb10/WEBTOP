import { useEffect, useMemo, useState } from 'react';
import { Button } from '../../../../components/ui/Button';
import { TextField } from '../../../../components/ui/fields';
import { Icon } from '../../../../components/ui/Icon';
import { DEFAULT_PERIODS } from '../../../../data/periods';
import type { Period, Timetable } from '../../../../schemas/timetable';
import { toast } from '../../../../store/uiStore';
import { createEmptyTimetable } from '../../../timetable/domain/timetableOps';
import { validatePeriods } from '../../../timetable/domain/periods';
import { getTemplateLessons, saveTemplate } from '../../api/templatesApi';
import type { TemplateRow } from '../../api/types';
import { errorMessage } from '../../domain/adminErrors';
import { presetMap, presetRowToLocal, rowsFromTimetable, timetableFromRows, withPeriods } from '../../domain/scheduleModel';
import { useLibraryPresets, useTemplates } from '../../state/resources';
import { PeriodsEditor } from '../schedule/PeriodsEditor';
import { WeekGrid } from '../schedule/WeekGrid';
import { Page, Panel } from '../shared/Page';
import { ErrorView, LoadingView } from '../shared/StatusViews';
import styles from '../schedule/schedule.module.css';
import userStyles from '../users/users.module.css';

interface TemplateEditorProps {
  /** null = new template. */
  template: TemplateRow | null;
  onDone: () => void;
}

/** Visual editor for a reusable weekly template: name, bell schedule and lessons. */
export function TemplateEditor({ template, onDone }: TemplateEditorProps) {
  const { data: presetRows, load: loadPresets } = useLibraryPresets();
  const [name, setName] = useState(template?.name ?? '');
  const [draft, setDraft] = useState<Timetable | null>(template ? null : createEmptyTimetable(DEFAULT_PERIODS));
  const [failure, setFailure] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    void loadPresets();
  }, [loadPresets]);

  useEffect(() => {
    if (!template || !presetRows) return undefined;
    let active = true;
    getTemplateLessons(template.id)
      .then((lessons) => active && setDraft(timetableFromRows(template.periods, lessons, presetMap(presetRows))))
      .catch((error: unknown) => active && setFailure(errorMessage(error)));
    return () => {
      active = false;
    };
  }, [template, presetRows]);

  const placeable = useMemo(() => (presetRows ?? []).filter((p) => !p.archived_at).map(presetRowToLocal), [presetRows]);

  const back = (
    <button type="button" className={userStyles.back} onClick={onDone}>
      <Icon name="arrowBack" size={20} />
      כל התבניות
    </button>
  );

  if (failure) return <Page title="תבנית" before={back}><ErrorView message={failure} /></Page>;
  if (!draft || !presetRows) return <Page title="תבנית" before={back}><LoadingView /></Page>;

  const periodErrors = validatePeriods(draft.periods);
  const nameError = name.trim() ? (name.trim().length > 60 ? 'עד 60 תווים' : undefined) : 'יש להזין שם';

  /** Saves the whole template (create or replace). */
  const save = async () => {
    if (nameError || periodErrors.length > 0) return;
    setBusy(true);
    try {
      await saveTemplate(template?.id ?? null, name.trim(), draft.periods, rowsFromTimetable(draft));
      toast('התבנית נשמרה. תלמידים שכבר קיבלו אותה לא משתנים עד שתחילו אותה שוב.', { tone: 'success', duration: 5000 });
      void useTemplates.getState().load(true);
      onDone();
    } catch (error) {
      toast(errorMessage(error), { tone: 'error', duration: 6000 });
    } finally {
      setBusy(false);
    }
  };

  return (
    <Page
      title={template ? `עריכת „${template.name}”` : 'תבנית חדשה'}
      before={back}
      actions={
        <Button variant="primary" disabled={busy || Boolean(nameError) || periodErrors.length > 0} onClick={() => void save()}>
          {busy ? 'שומר…' : 'שמירת התבנית'}
        </Button>
      }
    >
      <Panel>
        <TextField label="שם התבנית" value={name} onValueChange={setName} maxLength={60} error={name ? nameError : undefined} placeholder="למשל: שכבת י — מגמת ביוטכנולוגיה" />
      </Panel>
      <Panel title="שיעורים" id="template-grid">
        <WeekGrid timetable={draft} presets={placeable} onChange={setDraft} />
        <p className={styles.legend}>הקישו על משבצת כדי לבחור מקצוע או להשאיר אותה ריקה; אפשר גם להעביר ולהעתיק. בעכבר — גרירה (Alt/Ctrl = העתקה).</p>
      </Panel>
      <Panel title="שעות הלימוד" id="template-periods">
        <PeriodsEditor periods={draft.periods} onChange={(periods: Period[]) => setDraft(withPeriods(draft, periods))} />
      </Panel>
    </Page>
  );
}

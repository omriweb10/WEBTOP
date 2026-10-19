import { useEffect, useMemo, useState } from 'react';
import { Button } from '../../../../components/ui/Button';
import { confirm } from '../../../../components/ui/confirmStore';
import { SelectField } from '../../../../components/ui/fields';
import type { Period, Timetable } from '../../../../schemas/timetable';
import { toast } from '../../../../store/uiStore';
import { diffLessons } from '../../../account/domain/bundle';
import { validatePeriods } from '../../../timetable/domain/periods';
import { assignTemplate } from '../../api/templatesApi';
import { getUserTimetable, saveUserLessons, setUserPeriods } from '../../api/timetablesApi';
import type { UserOverview } from '../../api/types';
import { errorMessage } from '../../domain/adminErrors';
import { lessonsLostByResize, presetMap, presetRowToLocal, timetableFromRows, withPeriods } from '../../domain/scheduleModel';
import { useTemplates, useUsers } from '../../state/resources';
import { useUserPresets } from '../../state/userPresets';
import { PeriodsEditor } from '../schedule/PeriodsEditor';
import { WeekGrid } from '../schedule/WeekGrid';
import { Badge } from '../shared/Badge';
import { Panel } from '../shared/Page';
import { ErrorView, LoadingView } from '../shared/StatusViews';
import styles from '../schedule/schedule.module.css';
import userStyles from './users.module.css';

interface Loaded {
  baseline: Timetable;
  customized: boolean;
  sourceTemplateId: string | null;
}

/** The admin's view and editor of one student's own timetable. */
export function UserTimetablePanel({ user }: { user: UserOverview }) {
  const presets = useUserPresets(user.id);
  const templates = useTemplates();
  const [loaded, setLoaded] = useState<Loaded | null>(null);
  const [draft, setDraft] = useState<Timetable | null>(null);
  const [failure, setFailure] = useState<string | null>(null);
  const [version, setVersion] = useState(0);
  const [busy, setBusy] = useState(false);
  const [templateId, setTemplateId] = useState('');

  const loadTemplates = templates.load;
  useEffect(() => {
    void loadTemplates();
  }, [loadTemplates]);

  const presetRows = presets.data;
  useEffect(() => {
    if (!presetRows) return undefined;
    let active = true;
    getUserTimetable(user.id)
      .then((data) => {
        if (!active) return;
        const baseline = timetableFromRows(data.periods, data.lessons, presetMap(presetRows));
        setLoaded({ baseline, customized: data.customized, sourceTemplateId: data.source_template_id });
        setDraft(baseline);
        setFailure(null);
      })
      .catch((error: unknown) => active && setFailure(errorMessage(error)));
    return () => {
      active = false;
    };
  }, [user.id, presetRows, version]);

  const placeable = useMemo(() => (presetRows ?? []).filter((p) => !p.archived_at).map(presetRowToLocal), [presetRows]);

  if (failure) return <ErrorView message={failure} onRetry={() => setVersion((v) => v + 1)} />;
  if (presets.status === 'error' && presets.error && !presetRows) return <ErrorView message={presets.error} onRetry={() => void presets.reload()} />;
  if (!loaded || !draft) return <LoadingView />;

  const periodsChanged = JSON.stringify(draft.periods) !== JSON.stringify(loaded.baseline.periods);
  const changes = diffLessons(withPeriods(loaded.baseline, draft.periods), draft);
  const dirty = periodsChanged || changes.length > 0;
  const periodErrors = validatePeriods(draft.periods);
  const source = templates.data?.find((t) => t.id === loaded.sourceTemplateId);

  /** Applies a period change to the draft (lessons beyond the new end are dropped). */
  const changePeriods = (periods: Period[]) => setDraft(withPeriods(draft, periods));

  /** Saves periods first (the server trims lessons beyond them), then cell changes. */
  const save = async () => {
    const lost = lessonsLostByResize(loaded.baseline, draft.periods.length);
    if (periodsChanged && lost > 0) {
      const ok = await confirm({
        title: 'קיצור המערכת',
        message: `${lost} שיעורים נמצאים אחרי השעה האחרונה החדשה וימחקו. להמשיך?`,
        confirmLabel: 'שמירה',
        tone: 'danger',
      });
      if (!ok) return;
    }
    setBusy(true);
    try {
      if (periodsChanged) await setUserPeriods(user.id, draft.periods);
      if (changes.length > 0) await saveUserLessons(user.id, changes);
      toast('מערכת השעות של התלמיד/ה נשמרה', { tone: 'success' });
      setVersion((v) => v + 1);
      void presets.reload();
      void useUsers.getState().load(true);
    } catch (error) {
      toast(errorMessage(error), { tone: 'error', duration: 6000 });
    } finally {
      setBusy(false);
    }
  };

  /** Copies a template into this student's timetable (confirms when customised). */
  const applyTemplate = async () => {
    const template = templates.data?.find((t) => t.id === templateId);
    if (!template) return;
    const ok = await confirm({
      title: 'החלת תבנית',
      message:
        (loaded.customized
          ? `מערכת השעות של ${user.display_name} עברה התאמה אישית. החלת „${template.name}” תחליף את כל השינויים שלו/ה. להמשיך?`
          : `להחליף את מערכת השעות של ${user.display_name} בתבנית „${template.name}”?`) +
        ` מקצועות התבנית שעדיין אינם ברשימה של ${user.display_name} יתווספו אליה כעותקים עצמאיים.`,
      confirmLabel: 'החלה',
      tone: loaded.customized ? 'danger' : 'default',
    });
    if (!ok) return;
    try {
      await assignTemplate(template.id, [user.id], true);
      toast('התבנית הוחלה', { tone: 'success' });
      setVersion((v) => v + 1);
      void presets.reload();
      void useUsers.getState().load(true);
    } catch (error) {
      toast(errorMessage(error), { tone: 'error' });
    }
  };

  return (
    <>
      <Panel
        title="מערכת השעות האישית"
        id="user-timetable"
        actions={loaded.customized ? <Badge tone="warning">שונתה אישית</Badge> : <Badge tone="info">{source ? `לפי „${source.name}”` : 'ללא שינויים'}</Badge>}
      >
        <div className={styles.editorBar}>
          <Button variant="primary" disabled={!dirty || busy || periodErrors.length > 0} onClick={() => void save()}>
            {busy ? 'שומר…' : 'שמירת שינויים'}
          </Button>
          <Button disabled={!dirty || busy} onClick={() => setDraft(loaded.baseline)}>
            ביטול שינויים
          </Button>
          {dirty && <span className={styles.dirty}>יש שינויים שלא נשמרו</span>}
        </div>
        {placeable.length === 0 && (
          <p className={userStyles.note}>ל{user.display_name} עדיין אין מקצועות פעילים. הוסיפו אותם בלשונית „מקצועות” כדי לשבץ שיעורים.</p>
        )}
        <WeekGrid timetable={draft} presets={placeable} onChange={setDraft} />
        <p className={styles.legend}>
          הקישו על משבצת כדי לבחור מקצוע, לרוקן אותה או להעביר/להעתיק. בעכבר אפשר גם לגרור (Alt/Ctrl בזמן השחרור = העתקה). אפשר לשבץ רק מקצועות
          מהרשימה האישית של {user.display_name} (לשונית „מקצועות”).
        </p>
      </Panel>
      <Panel title="שעות הלימוד" id="user-periods">
        <PeriodsEditor periods={draft.periods} onChange={changePeriods} />
      </Panel>
      <Panel title="החלת תבנית" id="user-apply-template">
        {templates.data && templates.data.length > 0 ? (
          <>
            <SelectField
              label="תבנית"
              value={templateId}
              options={[{ value: '', label: 'בחרו תבנית…' }, ...templates.data.map((t) => ({ value: t.id, label: t.name }))]}
              onValueChange={setTemplateId}
            />
            <div className={userStyles.actions}>
              <Button icon="assignment" disabled={!templateId} onClick={() => void applyTemplate()}>
                החלה על התלמיד/ה
              </Button>
            </div>
          </>
        ) : (
          <p className={userStyles.note}>עדיין אין תבניות. אפשר ליצור אותן באזור „תבניות”.</p>
        )}
      </Panel>
    </>
  );
}

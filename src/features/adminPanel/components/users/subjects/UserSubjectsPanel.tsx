import { useState } from 'react';
import { Button } from '../../../../../components/ui/Button';
import { toast } from '../../../../../store/uiStore';
import { createPreset, setPresetArchived, updatePreset } from '../../../api/presetsApi';
import type { PresetFields, PresetRow, UserOverview } from '../../../api/types';
import { errorMessage } from '../../../domain/adminErrors';
import { lessonUsageLabel } from '../../../domain/formatters';
import { duplicateFields } from '../../../domain/presetCopy';
import { EMPTY_PRESET_FIELDS } from '../../../domain/presetForm';
import { useUserPresets } from '../../../state/userPresets';
import { PresetCard } from '../../presets/PresetCard';
import { PresetEditor } from '../../presets/PresetEditor';
import { Badge } from '../../shared/Badge';
import { Panel } from '../../shared/Page';
import { FilterChips } from '../../shared/SearchInput';
import { EmptyView, ErrorView, LoadingView } from '../../shared/StatusViews';
import presetStyles from '../../presets/presets.module.css';
import { CopySubjectsDialog, type CopySource } from './CopySubjectsDialog';
import { RemoveSubjectDialog } from './RemoveSubjectDialog';
import { SubjectImportDialog } from './import/SubjectImportDialog';

type Editing = { kind: 'new' } | { kind: 'edit'; preset: PresetRow } | { kind: 'duplicate'; preset: PresetRow } | null;

/**
 * One student's own subject list (Users → user → מקצועות). Only these subjects are offered
 * to the student in edit mode; nothing here affects any other user.
 */
export function UserSubjectsPanel({ user }: { user: UserOverview }) {
  const { data, status, error, reload } = useUserPresets(user.id);
  const [view, setView] = useState<'active' | 'hidden'>('active');
  const [editing, setEditing] = useState<Editing>(null);
  const [copyFrom, setCopyFrom] = useState<CopySource | null>(null);
  const [removing, setRemoving] = useState<PresetRow | null>(null);
  const [importing, setImporting] = useState(false);

  if (!data) {
    if (status === 'error' && error) return <ErrorView message={error} onRetry={() => void reload()} />;
    return <LoadingView />;
  }

  const active = data.filter((p) => !p.archived_at);
  const hidden = data.filter((p) => p.archived_at);
  const shown = view === 'active' ? active : hidden;
  const name = user.display_name;

  /** Runs a change and refreshes the list. */
  const run = async (action: () => Promise<unknown>, success: string) => {
    try {
      await action();
      toast(success, { tone: 'success' });
    } catch (failure) {
      toast(errorMessage(failure), { tone: 'error', duration: 7000 });
    } finally {
      void reload();
    }
  };

  /** Saves the editor: a new subject (also a duplicate) or changes to an existing one. */
  const save = async (fields: PresetFields): Promise<string | null> => {
    try {
      if (editing?.kind === 'edit') await updatePreset(editing.preset.id, fields);
      else await createPreset(user.id, fields);
      toast('המקצוע נשמר', { tone: 'success' });
      void reload();
      return null;
    } catch (failure) {
      return errorMessage(failure);
    }
  };

  return (
    <Panel title={`המקצועות של ${name}`} id="user-subjects">
      <p className={presetStyles.note}>
        רק המקצועות האלה מוצגים ל{name} בעריכת המערכת (7 הקשות על הכותרת), עם המורה, החדר והצבע שנקבעו כאן. שינוי ברשימה הזו אינו משפיע על
        אף משתמש אחר.
      </p>
      <div className={presetStyles.toolbar}>
        <Button icon="add" variant="primary" onClick={() => setEditing({ kind: 'new' })}>
          מקצוע חדש
        </Button>
        <Button icon="libraryAdd" onClick={() => setCopyFrom('library')}>
          הוספה מהמאגר
        </Button>
        <Button icon="group" onClick={() => setCopyFrom('user')}>
          העתקה ממשתמש אחר
        </Button>
        <Button icon="description" onClick={() => setImporting(true)}>
          ייבוא מקצועות מטקסט
        </Button>
      </div>
      <FilterChips
        label="מקצועות"
        value={view}
        onChange={setView}
        options={[
          { value: 'active', label: 'פעילים', count: active.length },
          { value: 'hidden', label: 'מוסתרים', count: hidden.length },
        ]}
      />
      {shown.length === 0 && (
        <EmptyView text={view === 'active' ? `ל${name} עדיין אין מקצועות. הוסיפו מקצוע חדש, מהמאגר או ממשתמש אחר.` : 'אין מקצועות מוסתרים.'} />
      )}
      <ul className={presetStyles.list} aria-label={`המקצועות של ${name}`}>
        {shown.map((preset) => (
          <PresetCard
            key={preset.id}
            preset={preset}
            heading="h3"
            badges={
              <>
                <Badge tone={preset.lesson_count > 0 ? 'info' : 'neutral'}>{lessonUsageLabel(preset.lesson_count)}</Badge>
                {preset.archived_at && <Badge tone="warning">מוסתר מהבחירה</Badge>}
              </>
            }
          >
            <Button icon="edit" onClick={() => setEditing({ kind: 'edit', preset })}>
              עריכה
            </Button>
            <Button icon="copy" onClick={() => setEditing({ kind: 'duplicate', preset })}>
              שכפול
            </Button>
            <Button
              icon={preset.archived_at ? 'visibility' : 'visibilityOff'}
              onClick={() =>
                void run(
                  () => setPresetArchived(preset.id, !preset.archived_at),
                  preset.archived_at ? 'המקצוע חזר לרשימת הבחירה' : 'המקצוע הוסתר מהבחירה. שיעורים קיימים נשארים.',
                )
              }
            >
              {preset.archived_at ? 'החזרה' : 'הסתרה'}
            </Button>
            <Button icon="delete" variant="danger" onClick={() => setRemoving(preset)}>
              הסרה
            </Button>
          </PresetCard>
        ))}
      </ul>

      {editing && (
        <PresetEditor
          key={editing.kind === 'new' ? 'new' : `${editing.kind}-${editing.preset.id}`}
          title={editing.kind === 'new' ? `מקצוע חדש ל${name}` : editing.kind === 'edit' ? `עריכת „${editing.preset.name}”` : `שכפול „${editing.preset.name}”`}
          initial={editing.kind === 'new' ? EMPTY_PRESET_FIELDS : editing.kind === 'edit' ? { ...editing.preset } : duplicateFields(editing.preset)}
          warning={
            editing.kind === 'edit' && editing.preset.lesson_count > 0
              ? `המקצוע ${lessonUsageLabel(editing.preset.lesson_count)} במערכת של ${name}. השינויים יופיעו בכל השיעורים האלה (רק אצל ${name}).`
              : undefined
          }
          onClose={() => setEditing(null)}
          onSave={save}
        />
      )}
      {copyFrom && (
        <CopySubjectsDialog target={user} targetPresets={data} initialSource={copyFrom} onClose={() => setCopyFrom(null)} onCopied={() => void reload()} />
      )}
      {importing && <SubjectImportDialog user={user} presets={data} onClose={() => setImporting(false)} onImported={() => void reload()} />}
      {removing && (
        <RemoveSubjectDialog
          user={user}
          preset={removing}
          presets={data}
          onClose={() => setRemoving(null)}
          onDone={() => {
            setRemoving(null);
            void reload();
          }}
        />
      )}
    </Panel>
  );
}

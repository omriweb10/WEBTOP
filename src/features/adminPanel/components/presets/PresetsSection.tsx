import { useEffect, useState } from 'react';
import { Button } from '../../../../components/ui/Button';
import { confirm } from '../../../../components/ui/confirmStore';
import { toast } from '../../../../store/uiStore';
import { createPreset, deletePreset, setPresetArchived, updatePreset } from '../../api/presetsApi';
import type { PresetRow } from '../../api/types';
import { errorMessage } from '../../domain/adminErrors';
import { EMPTY_PRESET_FIELDS } from '../../domain/presetForm';
import { usePresets } from '../../state/resources';
import { Page } from '../shared/Page';
import { FilterChips } from '../shared/SearchInput';
import { EmptyView, ErrorView, LoadingView } from '../shared/StatusViews';
import { AssignPresetDialog } from './AssignPresetDialog';
import { PresetEditor } from './PresetEditor';
import styles from './presets.module.css';

type Editing = { kind: 'new' } | { kind: 'edit'; preset: PresetRow } | null;

/** Subject presets: create, edit, archive, delete and hand out to students. */
export function PresetsSection() {
  const { data, status, error, load } = usePresets();
  const [view, setView] = useState<'active' | 'archived'>('active');
  const [editing, setEditing] = useState<Editing>(null);
  const [assigning, setAssigning] = useState<PresetRow | null>(null);

  useEffect(() => {
    void load();
  }, [load]);

  const active = (data ?? []).filter((p) => !p.archived_at);
  const archived = (data ?? []).filter((p) => p.archived_at);
  const shown = view === 'active' ? active : archived;

  /** Runs a change and refreshes the list. */
  const run = async (action: () => Promise<unknown>, success: string) => {
    try {
      await action();
      toast(success, { tone: 'success' });
    } catch (failure) {
      toast(errorMessage(failure), { tone: 'error', duration: 7000 });
    } finally {
      void load(true);
    }
  };

  /** Deletes after confirmation (refused by the database while the preset is in use). */
  const remove = async (preset: PresetRow) => {
    const ok = await confirm({
      title: 'מחיקת מקצוע',
      message: `למחוק את „${preset.name}”? אפשר למחוק רק מקצוע שאינו משובץ באף מערכת או תבנית. אחרת — העבירו אותו לארכיון.`,
      confirmLabel: 'מחיקה',
      tone: 'danger',
    });
    if (ok) await run(() => deletePreset(preset.id), 'המקצוע נמחק');
  };

  return (
    <Page
      title="מקצועות"
      subtitle="שם, מורה, חדר וצבע. שינוי מקצוע מתעדכן אצל כל התלמידים בלי לשנות את השיבוץ שלהם."
      actions={
        <Button icon="add" variant="primary" onClick={() => setEditing({ kind: 'new' })}>
          מקצוע חדש
        </Button>
      }
    >
      <FilterChips
        label="תצוגה"
        value={view}
        onChange={setView}
        options={[
          { value: 'active', label: 'פעילים', count: active.length },
          { value: 'archived', label: 'בארכיון', count: archived.length },
        ]}
      />
      {status === 'loading' && <LoadingView />}
      {status === 'error' && error && <ErrorView message={error} onRetry={() => void load(true)} />}
      {data && shown.length === 0 && <EmptyView text={view === 'active' ? 'אין מקצועות פעילים.' : 'הארכיון ריק.'} />}
      <ul className={styles.list}>
        {shown.map((preset) => (
          <li key={preset.id} className={styles.card} style={{ borderInlineStartColor: preset.color }}>
            <div className={styles.cardText}>
              <h2 className={styles.name}>{preset.name}</h2>
              {preset.short_name && <p className={styles.meta}>בתפריט: {preset.short_name}</p>}
              <p className={styles.meta}>{[preset.teacher, preset.room && `חדר ${preset.room}`].filter(Boolean).join(' · ') || 'ללא מורה וחדר'}</p>
              {preset.notes && <p className={styles.notes}>{preset.notes}</p>}
            </div>
            <div className={styles.cardActions}>
              <Button icon="edit" onClick={() => setEditing({ kind: 'edit', preset })}>
                עריכה
              </Button>
              {!preset.archived_at && (
                <Button icon="group" onClick={() => setAssigning(preset)}>
                  הקצאה
                </Button>
              )}
              <Button
                icon={preset.archived_at ? 'unarchive' : 'archive'}
                onClick={() => void run(() => setPresetArchived(preset.id, !preset.archived_at), preset.archived_at ? 'המקצוע שוחזר' : 'המקצוע הועבר לארכיון')}
              >
                {preset.archived_at ? 'שחזור' : 'ארכיון'}
              </Button>
              <Button icon="delete" variant="danger" onClick={() => void remove(preset)}>
                מחיקה
              </Button>
            </div>
          </li>
        ))}
      </ul>

      {editing && (
        <PresetEditor
          key={editing.kind === 'edit' ? editing.preset.id : 'new'}
          title={editing.kind === 'new' ? 'מקצוע חדש' : `עריכת „${editing.preset.name}”`}
          initial={editing.kind === 'edit' ? { ...editing.preset } : EMPTY_PRESET_FIELDS}
          onClose={() => setEditing(null)}
          onSave={async (fields) => {
            try {
              if (editing.kind === 'new') await createPreset(fields);
              else await updatePreset(editing.preset.id, fields);
              toast('המקצוע נשמר', { tone: 'success' });
              void load(true);
              return null;
            } catch (failure) {
              return errorMessage(failure);
            }
          }}
        />
      )}
      {assigning && <AssignPresetDialog preset={assigning} onClose={() => setAssigning(null)} />}
    </Page>
  );
}

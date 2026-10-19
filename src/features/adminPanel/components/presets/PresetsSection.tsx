import { useEffect, useState } from 'react';
import { Button } from '../../../../components/ui/Button';
import { confirm } from '../../../../components/ui/confirmStore';
import { toast } from '../../../../store/uiStore';
import { createPreset, removePreset, setPresetArchived, updatePreset } from '../../api/presetsApi';
import type { PresetRow } from '../../api/types';
import { errorMessage } from '../../domain/adminErrors';
import { EMPTY_PRESET_FIELDS } from '../../domain/presetForm';
import { useLibraryPresets } from '../../state/resources';
import { Badge } from '../shared/Badge';
import { Page } from '../shared/Page';
import { FilterChips } from '../shared/SearchInput';
import { EmptyView, ErrorView, LoadingView } from '../shared/StatusViews';
import { CopyToUsersDialog } from './CopyToUsersDialog';
import { PresetCard } from './PresetCard';
import { PresetEditor } from './PresetEditor';
import styles from './presets.module.css';

type Editing = { kind: 'new' } | { kind: 'edit'; preset: PresetRow } | null;

/**
 * The admin's subject library: the building blocks of templates and a source to copy
 * from. No student sees it; each student's own subjects live on their user page.
 */
export function PresetsSection() {
  const { data, status, error, load } = useLibraryPresets();
  const [view, setView] = useState<'active' | 'archived'>('active');
  const [editing, setEditing] = useState<Editing>(null);
  const [copying, setCopying] = useState<PresetRow | null>(null);

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

  /** Deletes after confirmation (refused by the database while a template uses it). */
  const remove = async (preset: PresetRow) => {
    const ok = await confirm({
      title: 'מחיקת מקצוע מהמאגר',
      message: `למחוק את „${preset.name}” מהמאגר? המקצועות שכבר הועתקו למשתמשים לא יושפעו. מקצוע שמשמש בתבנית אי אפשר למחוק — אפשר להעביר אותו לארכיון.`,
      confirmLabel: 'מחיקה',
      tone: 'danger',
    });
    if (ok) await run(() => removePreset(preset.id), 'המקצוע נמחק מהמאגר');
  };

  return (
    <Page
      title="מאגר מקצועות"
      subtitle="מקצועות לבניית תבניות ולהעתקה למשתמשים. אף תלמיד/ה לא רואים את המאגר: כל העתקה יוצרת מקצוע עצמאי ברשימה האישית שלהם, ושינוי כאן לא משנה אותו. את המקצועות של כל תלמיד/ה מנהלים בדף המשתמש."
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
      {data && shown.length === 0 && <EmptyView text={view === 'active' ? 'אין מקצועות פעילים במאגר.' : 'הארכיון ריק.'} />}
      <ul className={styles.list}>
        {shown.map((preset) => (
          <PresetCard
            key={preset.id}
            preset={preset}
            badges={preset.template_lesson_count > 0 && <Badge tone="info">בתבניות: {preset.template_lesson_count} משבצות</Badge>}
          >
            <Button icon="edit" onClick={() => setEditing({ kind: 'edit', preset })}>
              עריכה
            </Button>
            {!preset.archived_at && (
              <Button icon="group" onClick={() => setCopying(preset)}>
                העתקה למשתמשים
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
          </PresetCard>
        ))}
      </ul>

      {editing && (
        <PresetEditor
          key={editing.kind === 'edit' ? editing.preset.id : 'new'}
          title={editing.kind === 'new' ? 'מקצוע חדש במאגר' : `עריכת „${editing.preset.name}”`}
          initial={editing.kind === 'edit' ? { ...editing.preset } : EMPTY_PRESET_FIELDS}
          warning={
            editing.kind === 'edit' && editing.preset.template_lesson_count > 0
              ? 'המקצוע משמש בתבניות. השינוי יופיע בהן ובמשתמשים שיקבלו תבנית מעכשיו; מקצועות שכבר הועתקו למשתמשים לא ישתנו.'
              : undefined
          }
          onClose={() => setEditing(null)}
          onSave={async (fields) => {
            try {
              if (editing.kind === 'new') await createPreset(null, fields);
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
      {copying && <CopyToUsersDialog preset={copying} onClose={() => setCopying(null)} />}
    </Page>
  );
}

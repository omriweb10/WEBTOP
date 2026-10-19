import { useEffect, useMemo, useState } from 'react';
import { Button } from '../../../../../components/ui/Button';
import { SelectField } from '../../../../../components/ui/fields';
import { Modal } from '../../../../../components/ui/Modal';
import { toast } from '../../../../../store/uiStore';
import { copyPresets } from '../../../api/presetsApi';
import type { PresetRow, UserOverview } from '../../../api/types';
import { errorMessage } from '../../../domain/adminErrors';
import { presetDetails } from '../../../domain/formatters';
import { copyCandidates, defaultCopySelection } from '../../../domain/presetCopy';
import { useLibraryPresets, useUsers } from '../../../state/resources';
import { useUserPresets } from '../../../state/userPresets';
import { PresetChecklist } from '../../presets/PresetChecklist';
import { EmptyView, ErrorView, LoadingView } from '../../shared/StatusViews';
import presetStyles from '../../presets/presets.module.css';

export type CopySource = 'library' | 'user';

const LIBRARY = 'library';

interface CopySubjectsDialogProps {
  target: UserOverview;
  targetPresets: readonly PresetRow[];
  /** Start with the library selected, or ask which user to copy from. */
  initialSource: CopySource;
  onClose: () => void;
  onCopied: () => void;
}

/**
 * Adds several subjects at once to one student, from the library or from another student:
 * all of them or a selection. Every copy is a new, independent subject of the target.
 */
export function CopySubjectsDialog({ target, targetPresets, initialSource, onClose, onCopied }: CopySubjectsDialogProps) {
  const users = useUsers();
  const library = useLibraryPresets();
  const [source, setSource] = useState(initialSource === 'library' ? LIBRARY : '');
  // Per-source selection; until the admin changes it, the default applies.
  const [selections, setSelections] = useState<Record<string, Set<string>>>({});
  const [busy, setBusy] = useState(false);
  const sourceUserId = source !== '' && source !== LIBRARY ? source : null;
  const fromUser = useUserPresets(sourceUserId);

  const loadUsers = users.load;
  const loadLibrary = library.load;
  useEffect(() => {
    void loadUsers();
    void loadLibrary();
  }, [loadUsers, loadLibrary]);

  const origin = source === LIBRARY ? library : sourceUserId ? fromUser : null;
  const rows = origin?.data ?? null;
  const candidates = useMemo(() => (rows ? copyCandidates(rows, targetPresets) : []), [rows, targetPresets]);
  const selected = selections[source] ?? defaultCopySelection(candidates);
  const others = (users.data ?? []).filter((u) => u.id !== target.id);

  /** Copies the selected subjects into the target's list. */
  const copy = async () => {
    setBusy(true);
    try {
      const created = await copyPresets([...selected], [target.id]);
      toast(created === 1 ? `מקצוע אחד הועתק ל${target.display_name}` : `${created} מקצועות הועתקו ל${target.display_name}`, { tone: 'success' });
      onCopied();
      onClose();
    } catch (error) {
      toast(errorMessage(error), { tone: 'error' });
    } finally {
      setBusy(false);
    }
  };

  return (
    <Modal
      open
      title={`הוספת מקצועות ל${target.display_name}`}
      onClose={onClose}
      footer={
        <>
          <Button variant="primary" disabled={busy || selected.size === 0} onClick={() => void copy()}>
            {busy ? 'מעתיק…' : `העתקה (${selected.size})`}
          </Button>
          <Button variant="secondary" disabled={busy} onClick={onClose}>
            ביטול
          </Button>
        </>
      }
    >
      <p className={presetStyles.note}>
        ההעתקה יוצרת עותקים עצמאיים ברשימה של {target.display_name}. שינוי בעותק או במקור לא ישפיע על השני, ושום מקצוע אינו משותף בין
        משתמשים.
      </p>
      <SelectField
        label="העתקה מ־"
        value={source}
        options={[
          { value: '', label: 'בחרו מקור…' },
          { value: LIBRARY, label: 'מאגר המקצועות' },
          ...others.map((u) => ({ value: u.id, label: u.class_name ? `${u.display_name} (${u.class_name})` : u.display_name })),
        ]}
        onValueChange={setSource}
      />
      {origin &&
        (rows ? (
          candidates.length === 0 ? (
            <EmptyView text="אין כאן מקצועות פעילים להעתקה." />
          ) : (
            <PresetChecklist
              items={candidates.map(({ preset, existing }) => ({
                preset,
                hint: existing ? `כבר קיים אצל ${target.display_name}: ${presetDetails(existing)}` : undefined,
              }))}
              selected={selected}
              onChange={(next) => setSelections((current) => ({ ...current, [source]: next }))}
            />
          )
        ) : origin.status === 'error' && origin.error ? (
          <ErrorView message={origin.error} />
        ) : (
          <LoadingView />
        ))}
    </Modal>
  );
}

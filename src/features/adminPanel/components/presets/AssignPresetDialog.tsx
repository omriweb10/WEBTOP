import { useEffect, useState } from 'react';
import { Button } from '../../../../components/ui/Button';
import { Modal } from '../../../../components/ui/Modal';
import { toast } from '../../../../store/uiStore';
import { addPresetToUsers } from '../../api/presetsApi';
import type { PresetRow } from '../../api/types';
import { errorMessage } from '../../domain/adminErrors';
import { useUsers } from '../../state/resources';
import { LoadingView } from '../shared/StatusViews';
import { UserPicker } from '../shared/UserPicker';

/** Makes one subject available to many students at once. */
export function AssignPresetDialog({ preset, onClose }: { preset: PresetRow; onClose: () => void }) {
  const { data: users, load } = useUsers();
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    void load();
  }, [load]);

  /** Adds the preset to every selected student. */
  const assign = async () => {
    setBusy(true);
    try {
      const added = await addPresetToUsers(preset.id, [...selected]);
      toast(added > 0 ? `„${preset.name}” נוסף ל‑${added} משתמשים` : 'המקצוע כבר היה זמין לכל המשתמשים שנבחרו', { tone: 'success' });
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
      title={`הקצאת „${preset.name}”`}
      onClose={onClose}
      footer={
        <>
          <Button variant="primary" disabled={busy || selected.size === 0} onClick={() => void assign()}>
            הקצאה ל‑{selected.size} משתמשים
          </Button>
          <Button variant="secondary" onClick={onClose}>
            ביטול
          </Button>
        </>
      }
    >
      {users ? <UserPicker users={users} selected={selected} onChange={setSelected} /> : <LoadingView />}
    </Modal>
  );
}

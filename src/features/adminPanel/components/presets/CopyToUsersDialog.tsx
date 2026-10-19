import { useEffect, useState } from 'react';
import { Button } from '../../../../components/ui/Button';
import { Modal } from '../../../../components/ui/Modal';
import { toast } from '../../../../store/uiStore';
import { copyPresets } from '../../api/presetsApi';
import type { PresetRow } from '../../api/types';
import { errorMessage } from '../../domain/adminErrors';
import { useUsers } from '../../state/resources';
import { reloadUserPresets } from '../../state/userPresets';
import { LoadingView } from '../shared/StatusViews';
import { UserPicker } from '../shared/UserPicker';
import styles from './presets.module.css';

/** Copies one library subject into many students' own lists (independent copies). */
export function CopyToUsersDialog({ preset, onClose }: { preset: PresetRow; onClose: () => void }) {
  const { data: users, load } = useUsers();
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    void load();
  }, [load]);

  /** Creates a copy in every selected student's list. */
  const copy = async () => {
    setBusy(true);
    try {
      const created = await copyPresets([preset.id], [...selected]);
      reloadUserPresets([...selected]);
      toast(`„${preset.name}” הועתק ל‑${created} משתמשים`, { tone: 'success' });
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
      title={`העתקת „${preset.name}” למשתמשים`}
      onClose={onClose}
      footer={
        <>
          <Button variant="primary" disabled={busy || selected.size === 0} onClick={() => void copy()}>
            העתקה ל‑{selected.size} משתמשים
          </Button>
          <Button variant="secondary" onClick={onClose}>
            ביטול
          </Button>
        </>
      }
    >
      <p className={styles.note}>
        כל משתמש שנבחר יקבל עותק עצמאי ברשימת המקצועות האישית שלו. אפשר לשנות אחר כך מורה, חדר וצבע לכל משתמש בנפרד; שינוי במאגר לא ישנה את
        העותקים.
      </p>
      {users ? <UserPicker users={users} selected={selected} onChange={setSelected} /> : <LoadingView />}
    </Modal>
  );
}

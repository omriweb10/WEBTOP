import { useRef, useState, type ChangeEvent } from 'react';
import { Button } from '../../../components/ui/Button';
import { confirm } from '../../../components/ui/confirmStore';
import { Modal } from '../../../components/ui/Modal';
import type { BackupFile, BackupPart } from '../../../schemas/backup';
import { BACKUP_PART_LABELS, parseBackup, type ExportScope } from '../../../services/backup/backupService';
import { readFileAsText } from '../../../services/files/fileTransfer';
import { toast } from '../../../store/uiStore';
import { exportData, importBackup } from '../dataActions';
import styles from './AdminScreen.module.css';

const EXPORTS: ReadonlyArray<{ scope: ExportScope; label: string }> = [
  { scope: 'all', label: 'גיבוי מלא' },
  { scope: 'timetable', label: 'מערכת שעות בלבד' },
  { scope: 'presets', label: 'תבניות מקצועות בלבד' },
];

/**
 * JSON export and validated import. A file is parsed and validated completely before
 * the preview opens; nothing is written until the user picks parts and confirms.
 */
export function DataTransferSection() {
  const inputRef = useRef<HTMLInputElement>(null);
  const [pending, setPending] = useState<{ backup: BackupFile; parts: BackupPart[] } | null>(null);
  const [chosen, setChosen] = useState<BackupPart[]>([]);
  const [error, setError] = useState<string | null>(null);

  /** Exports one scope via the share sheet / download. */
  const runExport = async (scope: ExportScope) => {
    const outcome = await exportData(scope);
    if (outcome !== 'cancelled') toast('קובץ הגיבוי נוצר', { tone: 'success' });
  };

  /** Reads and validates the picked file, then opens the import preview. */
  const onFile = async (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    event.target.value = '';
    if (!file) return;
    setError(null);
    let text: string;
    try {
      text = await readFileAsText(file);
    } catch {
      setError('לא ניתן לקרוא את הקובץ');
      return;
    }
    const result = parseBackup(text);
    if (!result.ok) {
      setError(`${result.error}. הנתונים הקיימים לא שונו.`);
      return;
    }
    setPending({ backup: result.backup, parts: result.parts });
    setChosen(result.parts);
  };

  /** Confirms and applies the selected parts. */
  const applyImport = async () => {
    if (!pending || chosen.length === 0) return;
    const ok = await confirm({
      title: 'ייבוא נתונים',
      message: `הנתונים הבאים יוחלפו בתוכן הקובץ:\n${chosen.map((p) => `• ${BACKUP_PART_LABELS[p]}`).join('\n')}`,
      confirmLabel: 'ייבוא',
      tone: 'danger',
    });
    if (!ok) return;
    importBackup(pending.backup, chosen);
    setPending(null);
    toast('הנתונים יובאו בהצלחה', { tone: 'success' });
  };

  return (
    <div>
      <p className={styles.paragraph}>הקבצים נשמרים דרך גיליון השיתוף (למשל „שמירה ב‑Files”). מומלץ לגבות לפני שינויים גדולים.</p>
      <div className={styles.buttonGrid}>
        {EXPORTS.map(({ scope, label }) => (
          <Button key={scope} icon="download" onClick={() => void runExport(scope)}>
            ייצוא: {label}
          </Button>
        ))}
        <Button icon="upload" variant="primary" onClick={() => inputRef.current?.click()}>
          ייבוא מקובץ JSON…
        </Button>
      </div>
      <input
        ref={inputRef}
        type="file"
        accept="application/json,.json"
        className="visually-hidden"
        tabIndex={-1}
        aria-hidden="true"
        onChange={(event) => void onFile(event)}
        data-testid="import-input"
      />
      {error && (
        <p className={styles.error} role="alert">
          {error}
        </p>
      )}

      <Modal
        open={pending !== null}
        title="תצוגה מקדימה לייבוא"
        onClose={() => setPending(null)}
        footer={
          <>
            <Button variant="primary" disabled={chosen.length === 0} onClick={() => void applyImport()}>
              ייבוא החלקים שנבחרו
            </Button>
            <Button onClick={() => setPending(null)}>ביטול</Button>
          </>
        }
      >
        {pending && (
          <>
            <p className={styles.paragraph}>
              הקובץ תקין. נוצר: {new Date(pending.backup.exportedAt).toLocaleString('he-IL')} · גרסה {pending.backup.appVersion}
            </p>
            {pending.parts.map((part) => (
              <label key={part} className={styles.checkRow}>
                <input
                  type="checkbox"
                  checked={chosen.includes(part)}
                  onChange={() => setChosen((list) => (list.includes(part) ? list.filter((p) => p !== part) : [...list, part]))}
                />
                <span>{BACKUP_PART_LABELS[part]}</span>
              </label>
            ))}
          </>
        )}
      </Modal>
    </div>
  );
}

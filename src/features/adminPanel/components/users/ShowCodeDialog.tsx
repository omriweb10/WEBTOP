import { useState } from 'react';
import { Button } from '../../../../components/ui/Button';
import { Modal } from '../../../../components/ui/Modal';
import type { IssuedCode } from '../../api/types';
import styles from './codes.module.css';

/** Shows a freshly issued code exactly once, with copy support. */
export function ShowCodeDialog({ issued, studentName, onClose }: { issued: IssuedCode; studentName: string; onClose: () => void }) {
  const [copied, setCopied] = useState(false);

  /** Copies the code to the clipboard where supported. */
  const copy = async () => {
    try {
      await navigator.clipboard.writeText(issued.code);
      setCopied(true);
    } catch {
      setCopied(false);
    }
  };

  return (
    <Modal open variant="dialog" title={`קוד הגישה של ${studentName}`} onClose={onClose}>
      <p className={styles.once}>הקוד מוצג עכשיו בלבד. הוא לא נשמר במערכת ואי אפשר לשחזר אותו — רק להנפיק קוד חדש.</p>
      <output className={styles.code} dir="ltr" aria-label="קוד הגישה" data-testid="issued-code">
        {issued.code}
      </output>
      <p className={styles.hint}>העבירו את הקוד לתלמיד/ה בדרך בטוחה. הוא אינו סיסמה של WEBTOP.</p>
      <div className={styles.dialogActions}>
        <Button icon={copied ? 'check' : 'copy'} onClick={() => void copy()}>
          {copied ? 'הועתק' : 'העתקה'}
        </Button>
        <Button variant="primary" onClick={onClose}>
          סיימתי
        </Button>
      </div>
    </Modal>
  );
}

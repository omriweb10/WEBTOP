import type { PlanItem } from '../../../../domain/subjectImport/importPlan';
import presetStyles from '../../../presets/presets.module.css';
import styles from './subjectImport.module.css';

interface DuplicateChoiceProps {
  /** Subjects that already exist with different details (or hidden). */
  conflicts: readonly PlanItem[];
  update: boolean;
  onChange: (update: boolean) => void;
  studentName: string;
}

/** Skip (default) or explicitly update the student's existing subjects that differ. */
export function DuplicateChoice({ conflicts, update, onChange, studentName }: DuplicateChoiceProps) {
  if (conflicts.length === 0) return null;
  return (
    <section className={styles.duplicates} aria-labelledby="import-duplicates-title">
      <h3 id="import-duplicates-title" className={styles.duplicatesTitle}>
        {conflicts.length === 1 ? `מקצוע אחד כבר קיים אצל ${studentName} עם פרטים אחרים` : `${conflicts.length} מקצועות כבר קיימים אצל ${studentName} עם פרטים אחרים`}
      </h3>
      <ul className={styles.changeList}>
        {conflicts.map((item) => (
          <li key={item.subject.number}>
            <strong>{item.subject.fields.name}</strong> — {item.changes.map((c) => `${c.label}: ${c.from} ← ${c.to}`).join(' · ')}
          </li>
        ))}
      </ul>
      <fieldset className={presetStyles.choices}>
        <legend className="visually-hidden">מה לעשות במקצועות הקיימים</legend>
        <label className={presetStyles.choice}>
          <input type="radio" name="import-duplicates" checked={!update} onChange={() => onChange(false)} />
          <span className={presetStyles.choiceText}>
            <span className={presetStyles.choiceLabel}>לדלג עליהם</span>
            <span className={presetStyles.choiceHint}>המקצועות הקיימים נשארים בדיוק כמו שהם.</span>
          </span>
        </label>
        <label className={presetStyles.choice}>
          <input type="radio" name="import-duplicates" checked={update} onChange={() => onChange(true)} />
          <span className={presetStyles.choiceText}>
            <span className={presetStyles.choiceLabel}>לעדכן אותם לפי הטקסט</span>
            <span className={presetStyles.choiceHint}>המורה, החדר והצבע יוחלפו, והשיעורים שכבר משובצים יציגו את הפרטים החדשים.</span>
          </span>
        </label>
      </fieldset>
    </section>
  );
}

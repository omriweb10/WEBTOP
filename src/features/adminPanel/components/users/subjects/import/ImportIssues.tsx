import type { ImportIssue } from '../../../../domain/subjectImport/types';
import styles from './subjectImport.module.css';

/** "מקצוע 2 · אנגלית" — where an issue is. */
function where(issue: ImportIssue): string {
  return issue.subjectName ? `מקצוע ${issue.subject} · ${issue.subjectName}` : `מקצוע ${issue.subject}`;
}

/** What must be fixed before importing, per subject (the text stays as typed). */
export function ImportIssues({ issues }: { issues: readonly ImportIssue[] }) {
  if (issues.length === 0) return null;
  return (
    <section className={styles.issues} aria-labelledby="import-issues-title">
      <h3 id="import-issues-title" className={styles.issuesTitle}>
        {issues.length === 1 ? 'יש לתקן בעיה אחת בטקסט לפני הייבוא' : `יש לתקן ${issues.length} בעיות בטקסט לפני הייבוא`}
      </h3>
      <ul className={styles.issueList}>
        {issues.map((issue, index) => (
          <li key={`${issue.subject}-${issue.line ?? 0}-${index}`}>
            <span className={styles.issueWhere}>{where(issue)}:</span> {issue.message}
          </li>
        ))}
      </ul>
    </section>
  );
}

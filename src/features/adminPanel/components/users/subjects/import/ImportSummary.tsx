import type { PlanCounts } from '../../../../domain/subjectImport/importPlan';
import { Badge } from '../../../shared/Badge';
import styles from './subjectImport.module.css';

interface ImportSummaryProps {
  /** Subject blocks found in the text. */
  found: number;
  /** Of those, the ones without problems. */
  valid: number;
  counts: PlanCounts;
}

/** Live counters: subjects recognised, and how many the import creates, skips and updates. */
export function ImportSummary({ found, valid, counts }: ImportSummaryProps) {
  return (
    <div className={styles.summary} role="status" aria-label="סיכום הייבוא">
      <Badge tone={found > 0 && valid === found ? 'success' : found > 0 ? 'warning' : 'neutral'}>
        {valid === found ? `זוהו ${found} מקצועות` : `${valid} מתוך ${found} מקצועות תקינים`}
      </Badge>
      {valid > 0 && <Badge tone="info">ייווצרו {counts.create}</Badge>}
      {counts.skip > 0 && <Badge>ידולגו {counts.skip}</Badge>}
      {counts.update > 0 && <Badge tone="warning">יעודכנו {counts.update}</Badge>}
    </div>
  );
}

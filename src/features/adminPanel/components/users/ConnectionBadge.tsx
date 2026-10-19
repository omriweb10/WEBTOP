import { connectionState } from '../../domain/userFilters';
import { Badge } from '../shared/Badge';

/** "פעיל כעת" / "מחובר" / "לא מחובר" for a student's session. */
export function ConnectionBadge({ lastSeenAt, hasSession }: { lastSeenAt: string | null; hasSession: boolean }) {
  const state = connectionState(lastSeenAt, hasSession);
  if (state === 'active-now')
    return (
      <Badge tone="success" dot>
        פעיל כעת
      </Badge>
    );
  if (state === 'signed-in')
    return (
      <Badge tone="info" dot>
        מחובר
      </Badge>
    );
  return <Badge>לא מחובר</Badge>;
}

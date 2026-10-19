/** Student sessions: list and force-disconnect. */
import { db, unwrap } from './adminClient';
import type { SessionOverview } from './types';

/** Live sessions plus the most recent ended ones. */
export async function listSessions(recentLimit = 40): Promise<SessionOverview[]> {
  const [live, recent] = await Promise.all([
    unwrap<SessionOverview[]>(db().from('admin_session_overview').select('*').neq('status', 'ended').order('activated_at', { ascending: false })),
    unwrap<SessionOverview[]>(
      db().from('admin_session_overview').select('*').eq('status', 'ended').order('ended_at', { ascending: false }).limit(recentLimit),
    ),
  ]);
  return [...live, ...recent];
}

/** Ends a session immediately; its refresh tokens stop working and the code is free again. */
export async function disconnectSession(sessionId: string): Promise<boolean> {
  return unwrap<boolean>(db().rpc('admin_disconnect_session', { p_session_id: sessionId }));
}

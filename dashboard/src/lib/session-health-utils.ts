import type { SessionHealthOverview } from '../services/api';

export type SessionHealthIssue =
  | 'engine_relink_required'
  | 'ghost_ready_no_engine'
  | 'engine_disconnected_status_drift'
  | 'linked_session_disconnected'
  | 'pending_reconnect'
  | 'manually_stopped';

export function detectSessionHealthIssue(entry: SessionHealthOverview): SessionHealthIssue | null {
  if (entry.linkingMode) return null;
  if (entry.requiresRelink) return 'engine_relink_required';
  if (entry.manuallyStopped) return 'manually_stopped';
  if (entry.pendingReconnect) return 'pending_reconnect';

  if (
    (entry.liveStatus === 'ready' || entry.dbStatus === 'ready') &&
    !entry.enginePresent
  ) {
    return 'ghost_ready_no_engine';
  }

  if (
    entry.enginePresent &&
    entry.engineStatus === 'disconnected' &&
    (entry.liveStatus === 'ready' || entry.dbStatus === 'ready')
  ) {
    return 'engine_disconnected_status_drift';
  }

  if (entry.dbStatus === 'disconnected' || entry.dbStatus === 'failed') {
    return 'linked_session_disconnected';
  }

  return null;
}

export function isSessionHealthHealthy(entry: SessionHealthOverview): boolean {
  return detectSessionHealthIssue(entry) === null;
}

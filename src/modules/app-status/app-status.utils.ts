import { SessionStatus } from '../session/entities/session.entity';
import type { AppStatusLevel } from './app-status.types';

export interface SessionLike {
  id: string;
  name: string;
  status: string;
  lastActiveAt?: Date | string | null;
}

export function computeWhatsAppStatus(sessions: SessionLike[]): {
  status: AppStatusLevel;
  label: string;
  activeSessions: number;
  qrNeeded: number;
  disconnected: number;
} {
  if (!sessions.length) {
    return {
      status: 'neutral',
      label: 'No WA',
      activeSessions: 0,
      qrNeeded: 0,
      disconnected: 0,
    };
  }

  const activeSessions = sessions.filter(s => s.status === SessionStatus.READY).length;
  const qrNeeded = sessions.filter(s =>
    [SessionStatus.QR_READY, SessionStatus.AUTHENTICATING, SessionStatus.INITIALIZING].includes(
      s.status as SessionStatus,
    ),
  ).length;
  const disconnected = sessions.filter(s =>
    [SessionStatus.DISCONNECTED, SessionStatus.FAILED].includes(s.status as SessionStatus),
  ).length;

  let status: AppStatusLevel = 'error';
  let label = 'WA off';

  if (activeSessions > 0 && qrNeeded === 0) {
    status = 'success';
    label =
      activeSessions === 1
        ? 'WA OK'
        : `${activeSessions} WA`;
  } else if (activeSessions > 0) {
    status = 'warning';
    label = qrNeeded === 1 ? 'WA 1!' : `WA ${qrNeeded}!`;
  } else if (qrNeeded > 0) {
    status = 'warning';
    label = 'QR';
  } else if (sessions.length > 0) {
    status = 'error';
    label = 'WA off';
  }

  return { status, label, activeSessions, qrNeeded, disconnected };
}

export function computeAiStatus(input: {
  enabled: boolean;
  apiKeySet: boolean;
  testStatus?: string | null;
  autoReplyEnabled: boolean;
  autoReplyReady: boolean;
  masterEnabled: boolean;
  pendingLearning: number;
  knowledgeIndexed: boolean;
  safetyEnabled: boolean;
}): { status: AppStatusLevel; label: string; autoReply: 'on' | 'off' | 'paused' } {
  if (!input.enabled) {
    return { status: 'neutral', label: 'AI off', autoReply: 'off' };
  }

  if (!input.apiKeySet || input.testStatus === 'failed') {
    return {
      status: 'error',
      label: input.testStatus === 'failed' ? 'AI err' : 'AI cfg',
      autoReply: input.autoReplyEnabled && input.autoReplyReady ? 'on' : 'off',
    };
  }

  let status: AppStatusLevel = 'success';
  let label = 'AI OK';

  if (!input.safetyEnabled || !input.autoReplyReady || input.pendingLearning >= 10) {
    status = 'warning';
    if (!input.autoReplyReady && input.masterEnabled) {
      label = 'AI pause';
    } else if (input.pendingLearning >= 10) {
      label = 'AI learn';
    } else if (!input.knowledgeIndexed) {
      label = 'AI setup';
    } else {
      label = 'AI pause';
    }
  }

  const autoReply: 'on' | 'off' | 'paused' =
    !input.masterEnabled || !input.autoReplyEnabled
      ? 'off'
      : input.autoReplyReady
        ? 'on'
        : 'paused';

  return { status, label, autoReply };
}

export function computeQueueStatus(input: {
  pending: number;
  delayed: number;
  failed: number;
}): AppStatusLevel {
  if (input.failed > 0) return 'error';
  if (input.pending > 0 || input.delayed > 0) return 'warning';
  return 'success';
}

export function computeDatabaseStatus(input: {
  ok: boolean;
  latencyMs: number;
}): { status: AppStatusLevel; label: string } {
  if (!input.ok) {
    return { status: 'error', label: 'DB off' };
  }
  if (input.latencyMs > 1000) {
    return { status: 'warning', label: 'DB slow' };
  }
  return { status: 'success', label: 'DB OK' };
}

export function computeSyncStatus(input: {
  syncing: boolean;
  unsynced: number;
  failed: number;
  lastSyncAt: string | null;
}): { status: AppStatusLevel; label: string } {
  if (input.syncing) {
    return { status: 'loading', label: 'Sync…' };
  }
  if (input.failed > 0) {
    return { status: 'error', label: `${input.failed} fail` };
  }
  if (input.unsynced > 0) {
    return { status: 'warning', label: `${input.unsynced} unsync` };
  }
  return { status: 'success', label: 'Sync OK' };
}

export function computeOverallStatus(parts: {
  database: AppStatusLevel;
  whatsapp: AppStatusLevel;
  ai: AppStatusLevel;
  queue: AppStatusLevel;
  sync: AppStatusLevel;
}): AppStatusLevel {
  if (parts.database === 'error' || parts.whatsapp === 'error') return 'error';
  if (
    parts.queue === 'error' ||
    parts.sync === 'error' ||
    parts.ai === 'error' ||
    parts.whatsapp === 'warning' ||
    parts.queue === 'warning' ||
    parts.sync === 'warning' ||
    parts.ai === 'warning'
  ) {
    return 'warning';
  }
  if (parts.sync === 'loading') return 'loading';
  return 'success';
}

export function computeWorkEfficiency(pending: number, dueToday: number): number {
  const total = pending + dueToday;
  if (total <= 0) return 100;
  return Math.max(0, Math.min(100, Math.round((dueToday / total) * 100)));
}

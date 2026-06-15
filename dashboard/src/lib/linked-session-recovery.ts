import { sessionApi, type Session } from '../services/api';
import {
  canCallSessionStart,
  isSessionConnecting,
  isSessionRunning,
} from './session-status';

/** How long the inbox shows "Reconnecting…" before offering a manual Reconnect button. */
export const LINKED_SESSION_RECOVERY_TIMEOUT_MS = 90_000;

export function isLinkedSessionRecoverable(
  session: Pick<Session, 'phone' | 'requiresRelink'>,
): boolean {
  return Boolean(session.phone?.trim()) && !session.requiresRelink;
}

export function isLinkedSessionRecovering(
  session: Pick<Session, 'phone' | 'requiresRelink' | 'status'>,
): boolean {
  if (!isLinkedSessionRecoverable(session)) return false;
  if (session.status === 'ready' || session.status === 'failed') return false;
  return (
    session.status === 'disconnected' || isSessionConnecting(session.status)
  );
}

/** QR linking mode only for first link or when engine auth is missing. */
export function shouldUseLinkingMode(
  session: Pick<Session, 'phone' | 'requiresRelink'> | undefined,
): boolean {
  if (!session) return true;
  return !isLinkedSessionRecoverable(session);
}

function isAlreadyStartedError(err: unknown): boolean {
  const msg = err instanceof Error ? err.message : String(err);
  return msg.includes('already started');
}

/**
 * Soft-recover a linked session from saved on-disk auth (no QR).
 * Safe to call from app shell auto-start and background reconnect flows.
 */
export async function recoverLinkedSessionInBackground(
  session: Pick<Session, 'id' | 'status' | 'phone' | 'requiresRelink'>,
): Promise<void> {
  if (session.status === 'ready') return;
  if (!isLinkedSessionRecoverable(session)) return;

  if (isSessionRunning(session.status) || isSessionConnecting(session.status)) {
    return;
  }

  if (session.status === 'failed') {
    await sessionApi.restart(session.id);
    return;
  }

  if (!canCallSessionStart(session.status)) return;

  try {
    await sessionApi.start(session.id, { linkingMode: false });
  } catch (err) {
    if (isAlreadyStartedError(err)) return;
    throw err;
  }
}

import { sessionApi, whatsAppSafetyApi, type Session } from '../services/api';

export interface SessionLinkVerification {
  ok: boolean;
  status: Session['status'] | 'missing';
  requiresRelink: boolean;
  phone?: string | null;
  warmupActive: boolean;
  startupSafeMode: boolean;
}

/** Confirm a session finished linking and core services (warm-up, safe mode) initialized. */
export async function verifySessionLink(sessionId: string): Promise<SessionLinkVerification> {
  let session: Session | undefined;
  try {
    const sessions = await sessionApi.list();
    session = sessions.find(s => s.id === sessionId);
  } catch {
    session = undefined;
  }

  let warmupActive = false;
  let startupSafeMode = false;
  try {
    const health = await whatsAppSafetyApi.getSessionHealth(sessionId);
    warmupActive = health.warmup?.status === 'active' || health.warmup?.status === 'paused';
    startupSafeMode = Boolean(health.startupSafeMode);
  } catch {
    // Non-blocking — session may still be ready without health row yet.
  }

  const requiresRelink = session?.requiresRelink ?? true;
  const ok =
    session?.status === 'ready' && !requiresRelink && Boolean(session.phone?.trim());

  return {
    ok,
    status: session?.status ?? 'missing',
    requiresRelink,
    phone: session?.phone,
    warmupActive,
    startupSafeMode,
  };
}

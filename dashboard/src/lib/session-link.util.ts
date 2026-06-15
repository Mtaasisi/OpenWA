import type { Session } from '../services/api';

export function sessionNeedsLink(session: Session): boolean {
  return (
    session.requiresRelink ||
    session.status === 'disconnected' ||
    session.status === 'failed' ||
    session.status === 'created' ||
    session.status === 'qr_ready' ||
    !session.phone?.trim()
  );
}

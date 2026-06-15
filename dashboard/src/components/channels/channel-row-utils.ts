import type { Session, SmsStatusView } from '../../services/api';
import type { StatusBadgeVariant } from '../workspace/StatusBadge';

export function sessionStatusBadgeVariant(session: Session): StatusBadgeVariant {
  if (session.requiresRelink) return 'warning';
  if (session.status === 'ready') return 'success';
  if (
    session.status === 'qr_ready' ||
    session.status === 'authenticating' ||
    session.status === 'initializing' ||
    session.status === 'loading_chats'
  ) {
    return 'warning';
  }
  if (session.status === 'failed') return 'error';
  return 'neutral';
}

export function sessionStatusBadgeLabel(
  session: Session,
  t: (key: string, options?: Record<string, unknown>) => string,
): string {
  if (session.requiresRelink) return t('sessions.engine.scanQr');
  return t(`sessionStatus.${session.status}`, { defaultValue: session.status });
}

export function smsStatusBadgeVariant(sms: SmsStatusView | undefined): StatusBadgeVariant {
  if (!sms?.configured) return 'warning';
  if (sms.status === 'connected' && sms.connected) return 'success';
  if (sms.status === 'failed') return 'error';
  if (sms.status === 'low_balance' || sms.lowBalance) return 'warning';
  if (sms.status === 'testing') return 'warning';
  if (sms.status === 'disabled') return 'neutral';
  return 'warning';
}

export function sessionAvatarInitials(name: string): string {
  const parts = name.split(/[-_\s]+/).filter(Boolean);
  if (parts.length >= 2) return (parts[0][0] + parts[1][0]).toUpperCase();
  return name.slice(0, 2).toUpperCase();
}

export function sessionPreviewLine(
  session: Session,
  t: (key: string, options?: Record<string, unknown>) => string,
): string {
  if (session.pushName?.trim()) return session.pushName.trim();
  if (session.phone?.trim()) return session.phone.trim();
  if (session.requiresRelink) {
    return t('sessions.engine.requiresRelinkAuthMissing');
  }
  if (session.status === 'failed') return t('sessions.health.relinkRequired');
  if (session.statusMessage?.trim()) return session.statusMessage.trim();
  return t('sessions.details.phoneNone');
}

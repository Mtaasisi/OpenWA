import type { Session } from '../services/api';

/** Session has an active engine (starting or connected). */
export const SESSION_RUNNING_STATUSES = [
  'initializing',
  'qr_ready',
  'authenticating',
  'loading_chats',
  'ready',
] as const;

/** Session is starting but not yet connected. */
export const SESSION_CONNECTING_STATUSES = [
  'initializing',
  'qr_ready',
  'authenticating',
  'loading_chats',
] as const;

/** Session can call POST /start (engine not running). */
export const SESSION_STARTABLE_STATUSES = ['created', 'disconnected', 'failed'] as const;

export type SessionRunningStatus = (typeof SESSION_RUNNING_STATUSES)[number];
export type SessionConnectingStatus = (typeof SESSION_CONNECTING_STATUSES)[number];

export function isSessionRunning(status: Session['status'] | string | undefined): boolean {
  return !!status && (SESSION_RUNNING_STATUSES as readonly string[]).includes(status);
}

export function isSessionConnecting(status: Session['status'] | string | undefined): boolean {
  return !!status && (SESSION_CONNECTING_STATUSES as readonly string[]).includes(status);
}

export function canCallSessionStart(status: Session['status'] | string | undefined): boolean {
  return !!status && (SESSION_STARTABLE_STATUSES as readonly string[]).includes(status);
}

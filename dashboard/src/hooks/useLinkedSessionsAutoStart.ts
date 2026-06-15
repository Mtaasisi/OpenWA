import { useCallback, useEffect, useRef } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import type { Session } from '../services/api';
import { useRole } from './useRole';
import { queryKeys, useSessionsQuery } from './queries';
import {
  isLinkedSessionRecoverable,
  recoverLinkedSessionInBackground,
} from '../lib/linked-session-recovery';
import { canCallSessionStart } from '../lib/session-status';
import { useWebSocket, type SessionStatusEvent } from './useWebSocket';

const globalAutoStartedIds = new Set<string>();

/** Call after a session is removed so a new session with the same name can auto-start. */
export function forgetLinkedSessionAutoStart(sessionId: string): void {
  globalAutoStartedIds.delete(sessionId);
}

function shouldAutoRecover(session: Session): boolean {
  if (!isLinkedSessionRecoverable(session)) return false;
  if (session.status === 'ready') return false;
  return (
    session.status === 'disconnected' ||
    session.status === 'failed' ||
    canCallSessionStart(session.status)
  );
}

export interface UseLinkedSessionsAutoStartOptions {
  /** Session IDs to skip (e.g. user is actively scanning QR on Channels). */
  skipSessionIds?: string[];
  enabled?: boolean;
}

/**
 * App-wide: auto-recover linked WhatsApp sessions from disk auth when the dashboard opens.
 * Runs once per disconnect cycle (not only on the Channels/Sessions page).
 */
export function useLinkedSessionsAutoStart(
  options: UseLinkedSessionsAutoStartOptions = {},
): void {
  const { canWrite } = useRole();
  const queryClient = useQueryClient();
  const { data: sessions = [], isLoading } = useSessionsQuery({
    refetchInterval: 15_000,
  });
  const prevStatusRef = useRef<Map<string, Session['status']>>(new Map());
  const skipKey = options.skipSessionIds?.join(',') ?? '';

  useWebSocket({
    subscribeAllSessions: true,
    onSessionStatus: useCallback(
      (event: SessionStatusEvent) => {
        if (!event.deleted) return;
        forgetLinkedSessionAutoStart(event.sessionId);
        queryClient.setQueryData<Session[]>(queryKeys.sessions, prev =>
          prev ? prev.filter(s => s.id !== event.sessionId) : prev,
        );
        void queryClient.invalidateQueries({ queryKey: ['inbox'] });
        void queryClient.invalidateQueries({ queryKey: queryKeys.sessionStats });
      },
      [queryClient],
    ),
  });

  useEffect(() => {
    if (options.enabled === false) return;
    if (isLoading || !canWrite || sessions.length === 0) return;

    const skip = new Set(options.skipSessionIds ?? []);

    for (const session of sessions) {
      const prev = prevStatusRef.current.get(session.id);
      if (prev === 'ready' && session.status === 'disconnected') {
        globalAutoStartedIds.delete(session.id);
      }
      if (session.status === 'ready' || session.status === 'failed') {
        globalAutoStartedIds.delete(session.id);
      }
      prevStatusRef.current.set(session.id, session.status);
    }

    const pending = sessions.filter(session => {
      if (globalAutoStartedIds.has(session.id)) return false;
      if (skip.has(session.id)) return false;
      return shouldAutoRecover(session);
    });

    if (pending.length === 0) return;

    for (const session of pending) {
      globalAutoStartedIds.add(session.id);
    }

    void Promise.all(
      pending.map(async session => {
        try {
          await recoverLinkedSessionInBackground(session);
          void queryClient.invalidateQueries({ queryKey: queryKeys.sessions });
          void queryClient.invalidateQueries({ queryKey: queryKeys.sessionStats });
        } catch {
          globalAutoStartedIds.delete(session.id);
        }
      }),
    );
  }, [
    isLoading,
    canWrite,
    sessions,
    skipKey,
    options.enabled,
    queryClient,
    options.skipSessionIds,
  ]);
}

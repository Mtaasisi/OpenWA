import { useCallback, useEffect, useRef, useState } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { sessionApi, whatsAppSafetyApi, type Session } from '../services/api';
import { queryKeys } from './queries';
import { useWebSocket, type SessionStatusEvent } from './useWebSocket';
import type { SessionQrModalState } from '../components/SessionQrModal';
import type { LinkPreflightAction } from '../components/WhatsAppLinkSafetyModal';
import { isSessionConnecting, isSessionRunning } from '../lib/session-status';
import {
  recoverLinkedSessionInBackground,
  shouldUseLinkingMode,
} from '../lib/linked-session-recovery';
import { forgetLinkedSessionAutoStart } from './useLinkedSessionsAutoStart';
import { buildLinkSafetyAutoFixPatch } from '../lib/whatsapp-link-safety.util';
import { verifySessionLink, type SessionLinkVerification } from '../lib/session-link-verify';

export interface LinkPreflightRequest {
  sessionId: string;
  sessionName: string;
  action: LinkPreflightAction;
  onExecute: () => void | Promise<void>;
}

const QR_POLL_MS = 5000;
const QR_RETRY_DELAY_MS = 1500;
const QR_MAX_RETRIES = 24;

const CONNECT_PHASE_RANK: Record<string, number> = {
  created: 0,
  disconnected: 0,
  failed: 0,
  initializing: 1,
  qr_ready: 2,
  authenticating: 3,
  loading_chats: 4,
  ready: 5,
};

function sleep(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms));
}

function connectPhaseRank(status: Session['status'] | string | undefined): number {
  return CONNECT_PHASE_RANK[status ?? ''] ?? 0;
}

/** Don't attach stale loading/sync messages while the QR scan step is active. */
function pollStatusMessage(
  status: Session['status'],
  statusMessage: string | undefined,
): string | undefined {
  if (status === 'qr_ready' || status === 'initializing') return undefined;
  return statusMessage;
}

function mergeConnectStatus(
  prev: Session['status'] | undefined,
  incoming: Session['status'] | undefined,
): Session['status'] {
  if (!incoming) return prev ?? 'initializing';
  if (!prev) return incoming;
  return connectPhaseRank(incoming) >= connectPhaseRank(prev) ? incoming : prev;
}

export interface UseSessionStartFlowOptions {
  onReady?: (sessionId: string, verification: SessionLinkVerification) => void;
  onError?: (message: string) => void;
  onSessionStatus?: (event: SessionStatusEvent) => void;
}

export function useSessionStartFlow(options: UseSessionStartFlowOptions = {}) {
  const queryClient = useQueryClient();
  const [starting, setStarting] = useState(false);
  const [linkPreflight, setLinkPreflight] = useState<LinkPreflightRequest | null>(null);
  const [qrModal, setQrModal] = useState<SessionQrModalState | null>(null);
  const qrModalRef = useRef<SessionQrModalState | null>(null);
  const connectingSessionRef = useRef<string | null>(null);
  qrModalRef.current = qrModal;

  const refreshSessions = useCallback(() => {
    void queryClient.invalidateQueries({ queryKey: queryKeys.sessions });
    void queryClient.invalidateQueries({ queryKey: queryKeys.sessionStats });
    void queryClient.invalidateQueries({ queryKey: ['whatsapp-safety', 'link-preflight-summary'] });
  }, [queryClient]);

  const abandonConnectFlow = useCallback(() => {
    connectingSessionRef.current = null;
    setQrModal(null);
  }, []);

  const hideQrModal = useCallback(() => {
    setQrModal(null);
  }, []);

  const openQrModal = useCallback(
    (sessionId: string, sessionName: string, qrCode = '', status?: Session['status']) => {
      setQrModal(prev => {
        const sameSession = prev?.sessionId === sessionId;
        const nextStatus = mergeConnectStatus(
          sameSession ? prev?.status : undefined,
          status,
        );
        return {
          sessionId,
          sessionName,
          qrCode: qrCode || (sameSession ? prev?.qrCode : '') || '',
          status: nextStatus,
          statusMessage: sameSession ? pollStatusMessage(nextStatus, prev?.statusMessage) : undefined,
          failureCode: sameSession ? prev?.failureCode : undefined,
        };
      });
    },
    [],
  );

  const patchQrModal = useCallback((patch: Partial<SessionQrModalState>) => {
    setQrModal(prev => {
      if (!prev) return prev;
      const nextStatus = (patch.status ?? prev.status) as Session['status'];
      const statusMessage =
        patch.statusMessage !== undefined
          ? pollStatusMessage(nextStatus, patch.statusMessage)
          : pollStatusMessage(nextStatus, prev.statusMessage);
      return {
        ...prev,
        ...patch,
        status: mergeConnectStatus(prev.status, patch.status),
        statusMessage,
      };
    });
  }, []);

  const notifyReady = useCallback(
    (sessionId: string) => {
      void sessionApi.setLinkingMode(sessionId, false).catch(() => undefined);
      void verifySessionLink(sessionId).then(verification => {
        options.onReady?.(sessionId, verification);
      });
    },
    [options],
  );

  const fetchQrOnce = useCallback(
    async (sessionId: string, sessionName: string): Promise<'ready' | 'qr' | 'wait' | 'error'> => {
      try {
        const qr = await sessionApi.getQR(sessionId);
        const apiStatus = qr.status as Session['status'];
        if (qr.status === 'ready') {
          connectingSessionRef.current = null;
          hideQrModal();
          refreshSessions();
          notifyReady(sessionId);
          return 'ready';
        }
        if (qr.status === 'failed') {
          setQrModal({
            sessionId,
            sessionName,
            qrCode: '',
            status: 'failed',
            statusMessage: qr.statusMessage,
            failureCode: qr.failureCode,
          });
          return 'error';
        }
        if (qr.qrCode) {
          setQrModal(prev => {
            const sameSession = prev?.sessionId === sessionId;
            const nextStatus = mergeConnectStatus(
              sameSession ? prev?.status : undefined,
              apiStatus ?? 'qr_ready',
            );
            return {
              sessionId,
              sessionName,
              qrCode: qr.qrCode,
              status: nextStatus === 'qr_ready' ? 'qr_ready' : nextStatus,
              statusMessage: pollStatusMessage(
                nextStatus === 'qr_ready' ? 'qr_ready' : nextStatus,
                qr.statusMessage,
              ),
              failureCode: qr.failureCode,
            };
          });
          return 'qr';
        }
        setQrModal(prev => {
          const sameSession = prev?.sessionId === sessionId;
          let nextStatus = mergeConnectStatus(
            sameSession ? prev?.status : undefined,
            apiStatus,
          );
          if (sameSession && prev?.qrCode && connectPhaseRank(apiStatus) < connectPhaseRank('qr_ready')) {
            nextStatus = prev.status ?? 'qr_ready';
          }
          return {
            sessionId,
            sessionName,
            qrCode: sameSession ? prev?.qrCode ?? '' : '',
            status: nextStatus,
            statusMessage: pollStatusMessage(nextStatus, qr.statusMessage),
            failureCode: qr.failureCode,
          };
        });
        return 'wait';
      } catch (err) {
        const msg = err instanceof Error ? err.message : '';
        if (
          msg.includes('already authenticated') ||
          msg.includes('no QR code needed') ||
          msg.includes('not ready') ||
          msg.includes('not started') ||
          msg.includes('Please wait')
        ) {
          if (msg.includes('already authenticated') || msg.includes('no QR code needed')) {
            connectingSessionRef.current = null;
            hideQrModal();
            refreshSessions();
            notifyReady(sessionId);
            return 'ready';
          }
          return 'wait';
        }
        return 'error';
      }
    },
    [hideQrModal, refreshSessions, notifyReady],
  );

  const pollQrUntilShown = useCallback(
    async (sessionId: string, sessionName: string, initialStatus?: Session['status']) => {
      const startStatus =
        initialStatus && isSessionConnecting(initialStatus) ? initialStatus : 'initializing';
      openQrModal(sessionId, sessionName, '', startStatus);
      for (let i = 0; i < QR_MAX_RETRIES; i++) {
        const result = await fetchQrOnce(sessionId, sessionName);
        if (result === 'ready' || result === 'qr') return;
        if (result === 'error') return;
        await sleep(QR_RETRY_DELAY_MS);
      }
    },
    [fetchQrOnce, openQrModal],
  );

  const continueQrInBackground = useCallback(() => {
    hideQrModal();
  }, [hideQrModal]);

  const requestLinkPreflight = useCallback((req: LinkPreflightRequest) => {
    setLinkPreflight(req);
  }, []);

  const confirmLinkPreflight = useCallback(async () => {
    const req = linkPreflight;
    setLinkPreflight(null);
    if (!req) return;

    try {
      const preflight = await whatsAppSafetyApi.getLinkPreflight(req.sessionId);
      const patch = buildLinkSafetyAutoFixPatch(preflight.items);
      if (Object.keys(patch).length > 0) {
        await whatsAppSafetyApi.patchSettings(patch as never);
        refreshSessions();
      }
    } catch {
      // Non-blocking — user may have already fixed settings manually.
    }

    await Promise.resolve(req.onExecute());
  }, [linkPreflight, refreshSessions]);

  const cancelLinkPreflight = useCallback(() => {
    setLinkPreflight(null);
  }, []);

  const executeStartSessionFlow = useCallback(
    async (sessionId: string, sessions: Session[]) => {
      const session = sessions.find(s => s.id === sessionId);
      const sessionName = session?.name ?? sessionId;
      const status = session?.status;

      if (status === 'ready') {
        return;
      }

      connectingSessionRef.current = sessionId;

      const needsQrLink = shouldUseLinkingMode(session);

      if (status && isSessionConnecting(status)) {
        if (needsQrLink) {
          openQrModal(sessionId, sessionName, '', status);
          void pollQrUntilShown(sessionId, sessionName, status);
        }
        return;
      }

      if (status && isSessionRunning(status)) {
        if (needsQrLink) {
          openQrModal(sessionId, sessionName, '', status);
          void pollQrUntilShown(sessionId, sessionName, status);
        }
        return;
      }

      setStarting(true);
      try {
        if (!needsQrLink && session) {
          await recoverLinkedSessionInBackground(session);
          refreshSessions();
          return;
        }
        await sessionApi.start(sessionId, { linkingMode: true });
        refreshSessions();
        openQrModal(sessionId, sessionName, '', 'initializing');
        void pollQrUntilShown(sessionId, sessionName, 'initializing');
      } catch (err) {
        const msg = err instanceof Error ? err.message : 'Failed to start session';
        if (msg.includes('already started')) {
          refreshSessions();
          const live = sessions.find(s => s.id === sessionId)?.status;
          openQrModal(sessionId, sessionName, '', live ?? 'initializing');
          void pollQrUntilShown(sessionId, sessionName, live);
          return;
        }
        options.onError?.(msg);
        throw err;
      } finally {
        setStarting(false);
      }
    },
    [openQrModal, pollQrUntilShown, refreshSessions, options],
  );

  const startSessionFlow = useCallback(
    async (
      sessionId: string,
      sessions: Session[],
      flowOpts?: { skipPreflight?: boolean; action?: LinkPreflightAction },
    ) => {
      if (flowOpts?.skipPreflight) {
        return executeStartSessionFlow(sessionId, sessions);
      }
      const session = sessions.find(s => s.id === sessionId);
      requestLinkPreflight({
        sessionId,
        sessionName: session?.name ?? sessionId,
        action: flowOpts?.action ?? 'start',
        onExecute: () => executeStartSessionFlow(sessionId, sessions),
      });
    },
    [executeStartSessionFlow, requestLinkPreflight],
  );

  /** Start engine without opening the QR modal — used when the Sessions view loads. */
  const startSessionInBackground = useCallback(
    async (sessionId: string, sessions: Session[]) => {
      const session = sessions.find(s => s.id === sessionId);
      if (!session) return;

      try {
        await recoverLinkedSessionInBackground(session);
        refreshSessions();
      } catch (err) {
        const msg = err instanceof Error ? err.message : '';
        if (msg.includes('already started')) {
          refreshSessions();
        }
      }
    },
    [refreshSessions],
  );

  const startAllSessionsInBackground = useCallback(
    async (sessions: Session[], skipSessionIds: string[] = []) => {
      const skip = new Set(skipSessionIds);
      const targets = sessions.filter(s => !skip.has(s.id) && shouldUseLinkingMode(s) === false);
      await Promise.all(targets.map(s => startSessionInBackground(s.id, sessions)));
    },
    [startSessionInBackground],
  );

  const retrySessionFlow = useCallback(
    async (sessionId: string, sessions: Session[]) => {
      abandonConnectFlow();
      await startSessionFlow(sessionId, sessions, { skipPreflight: true });
    },
    [abandonConnectFlow, startSessionFlow],
  );

  useWebSocket({
    subscribeAllSessions: true,
    onSessionStatus: useCallback(
      (event: SessionStatusEvent) => {
        if (event.deleted) {
          forgetLinkedSessionAutoStart(event.sessionId);
          void queryClient.setQueryData<Session[]>(queryKeys.sessions, prev =>
            prev ? prev.filter(s => s.id !== event.sessionId) : prev,
          );
          if (qrModalRef.current?.sessionId === event.sessionId) {
            hideQrModal();
          }
          if (connectingSessionRef.current === event.sessionId) {
            connectingSessionRef.current = null;
          }
          void queryClient.invalidateQueries({ queryKey: ['inbox'] });
          void queryClient.invalidateQueries({ queryKey: queryKeys.sessionStats });
          options.onSessionStatus?.(event);
          return;
        }

        void queryClient.setQueryData<Session[]>(queryKeys.sessions, prev => {
          if (!prev) return prev;
          return prev.map(s =>
            s.id === event.sessionId
              ? {
                  ...s,
                  status: event.status as Session['status'],
                  ...(event.backgroundSyncing !== undefined
                    ? { backgroundSyncing: event.backgroundSyncing }
                    : {}),
                  ...(event.statusMessage !== undefined
                    ? {
                        statusMessage:
                          event.status === 'ready' && event.backgroundSyncing
                            ? event.statusMessage
                            : event.status === 'qr_ready' ||
                                event.status === 'authenticating'
                              ? undefined
                              : event.statusMessage,
                      }
                    : {}),
                }
              : s,
          );
        });
        options.onSessionStatus?.(event);
        const modal = qrModalRef.current;
        const isActiveSession =
          modal?.sessionId === event.sessionId ||
          connectingSessionRef.current === event.sessionId;

        if (isActiveSession && event.status === 'qr_ready') {
          const sessionName =
            modal?.sessionId === event.sessionId
              ? modal.sessionName
              : (queryClient.getQueryData<Session[]>(queryKeys.sessions)?.find(s => s.id === event.sessionId)
                  ?.name ?? event.sessionId);
          if (!modal || modal.sessionId !== event.sessionId) {
            openQrModal(event.sessionId, sessionName, '', 'qr_ready');
          } else {
            patchQrModal({
              status: event.status as Session['status'],
              statusMessage: undefined,
              failureCode: event.failureCode,
            });
          }
          if (!modal?.qrCode || modal.sessionId !== event.sessionId) {
            void fetchQrOnce(event.sessionId, sessionName);
          }
        } else if (modal?.sessionId === event.sessionId) {
          patchQrModal({
            status: event.status as Session['status'],
            statusMessage: event.statusMessage,
            failureCode: event.failureCode,
          });
        }
        if (event.status === 'ready' && isActiveSession) {
          connectingSessionRef.current = null;
          hideQrModal();
          refreshSessions();
          notifyReady(event.sessionId);
        } else if (event.status === 'failed' && isActiveSession) {
          connectingSessionRef.current = null;
          const sessionName =
            modal?.sessionId === event.sessionId
              ? modal.sessionName
              : (queryClient.getQueryData<Session[]>(queryKeys.sessions)?.find(s => s.id === event.sessionId)
                  ?.name ?? event.sessionId);
          setQrModal({
            sessionId: event.sessionId,
            sessionName,
            qrCode: '',
            status: 'failed',
            statusMessage: event.statusMessage,
            failureCode: event.failureCode,
          });
          refreshSessions();
        }
      },
      [
        refreshSessions,
        hideQrModal,
        patchQrModal,
        openQrModal,
        options,
        queryClient,
        fetchQrOnce,
        notifyReady,
      ],
    ),
    onQRCode: useCallback(
      (event: { sessionId: string; qrCode: string }) => {
        const cachedName = queryClient
          .getQueryData<Session[]>(queryKeys.sessions)
          ?.find(s => s.id === event.sessionId)?.name;
        setQrModal(prev => {
          if (prev && prev.sessionId !== event.sessionId) return prev;
          return {
            sessionId: event.sessionId,
            sessionName: prev?.sessionName ?? cachedName ?? event.sessionId,
            qrCode: event.qrCode,
            status: 'qr_ready',
            statusMessage: undefined,
            failureCode: prev?.failureCode,
          };
        });
      },
      [queryClient],
    ),
  });

  useEffect(() => {
    if (!qrModal) return;
    if (qrModal.status === 'authenticating' || qrModal.status === 'loading_chats') return;
    const id = qrModal.sessionId;
    const name = qrModal.sessionName;
    const interval = setInterval(() => {
      void fetchQrOnce(id, name);
    }, QR_POLL_MS);
    return () => clearInterval(interval);
  }, [qrModal, fetchQrOnce]);

  return {
    starting,
    qrModal,
    linkPreflight,
    closeQrModal: abandonConnectFlow,
    continueQrInBackground,
    startSessionFlow,
    requestLinkPreflight,
    confirmLinkPreflight,
    cancelLinkPreflight,
    startSessionInBackground,
    startAllSessionsInBackground,
    retrySessionFlow,
    refreshSessions,
  };
}

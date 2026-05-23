import { useCallback, useEffect, useRef, useState } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { sessionApi, type Session } from '../services/api';
import { queryKeys } from './queries';
import { useWebSocket } from './useWebSocket';
import type { SessionQrModalState } from '../components/SessionQrModal';
import { isSessionConnecting, isSessionRunning } from '../lib/session-status';

const QR_POLL_MS = 5000;
const QR_RETRY_DELAY_MS = 1500;
const QR_MAX_RETRIES = 24;

function sleep(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms));
}

export interface UseSessionStartFlowOptions {
  onReady?: (sessionId: string) => void;
  onError?: (message: string) => void;
  onSessionStatus?: (event: { sessionId: string; status: string }) => void;
}

export function useSessionStartFlow(options: UseSessionStartFlowOptions = {}) {
  const queryClient = useQueryClient();
  const [starting, setStarting] = useState(false);
  const [qrModal, setQrModal] = useState<SessionQrModalState | null>(null);
  const qrModalRef = useRef<SessionQrModalState | null>(null);
  qrModalRef.current = qrModal;

  const refreshSessions = useCallback(() => {
    void queryClient.invalidateQueries({ queryKey: queryKeys.sessions });
    void queryClient.invalidateQueries({ queryKey: queryKeys.sessionStats });
  }, [queryClient]);

  const closeQrModal = useCallback(() => {
    setQrModal(null);
  }, []);

  const openQrModal = useCallback((sessionId: string, sessionName: string, qrCode = '') => {
    setQrModal({ sessionId, sessionName, qrCode });
  }, []);

  const fetchQrOnce = useCallback(
    async (sessionId: string, sessionName: string): Promise<'ready' | 'qr' | 'wait' | 'error'> => {
      try {
        const qr = await sessionApi.getQR(sessionId);
        if (qr.status === 'ready') {
          closeQrModal();
          refreshSessions();
          options.onReady?.(sessionId);
          return 'ready';
        }
        if (qr.qrCode) {
          openQrModal(sessionId, sessionName, qr.qrCode);
          return 'qr';
        }
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
            closeQrModal();
            refreshSessions();
            options.onReady?.(sessionId);
            return 'ready';
          }
          return 'wait';
        }
        return 'error';
      }
    },
    [closeQrModal, openQrModal, refreshSessions, options],
  );

  const pollQrUntilShown = useCallback(
    async (sessionId: string, sessionName: string) => {
      openQrModal(sessionId, sessionName, '');
      for (let i = 0; i < QR_MAX_RETRIES; i++) {
        const result = await fetchQrOnce(sessionId, sessionName);
        if (result === 'ready' || result === 'qr') return;
        await sleep(QR_RETRY_DELAY_MS);
      }
    },
    [fetchQrOnce, openQrModal],
  );

  const startSessionFlow = useCallback(
    async (sessionId: string, sessions: Session[]) => {
      const session = sessions.find(s => s.id === sessionId);
      const sessionName = session?.name ?? sessionId;
      const status = session?.status;

      if (status === 'ready') {
        return;
      }

      if (status && isSessionConnecting(status)) {
        openQrModal(sessionId, sessionName, '');
        void pollQrUntilShown(sessionId, sessionName);
        return;
      }

      if (status && isSessionRunning(status)) {
        openQrModal(sessionId, sessionName, '');
        void pollQrUntilShown(sessionId, sessionName);
        return;
      }

      setStarting(true);
      try {
        await sessionApi.start(sessionId);
        refreshSessions();
        openQrModal(sessionId, sessionName, '');
        void pollQrUntilShown(sessionId, sessionName);
      } catch (err) {
        const msg = err instanceof Error ? err.message : 'Failed to start session';
        if (msg.includes('already started')) {
          refreshSessions();
          openQrModal(sessionId, sessionName, '');
          void pollQrUntilShown(sessionId, sessionName);
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

  useWebSocket({
    subscribeAllSessions: true,
    onSessionStatus: useCallback(
      (event: { sessionId: string; status: string }) => {
        refreshSessions();
        options.onSessionStatus?.(event);
        if (event.status === 'ready' && qrModalRef.current?.sessionId === event.sessionId) {
          closeQrModal();
          options.onReady?.(event.sessionId);
        }
      },
      [refreshSessions, closeQrModal, options],
    ),
    onQRCode: useCallback((event: { sessionId: string; qrCode: string }) => {
      setQrModal(prev => {
        if (!prev || prev.sessionId !== event.sessionId) return prev;
        return { ...prev, qrCode: event.qrCode };
      });
    }, []),
  });

  useEffect(() => {
    if (!qrModal) return;
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
    closeQrModal,
    startSessionFlow,
    refreshSessions,
  };
}

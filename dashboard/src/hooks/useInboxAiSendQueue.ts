import { useCallback, useEffect, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { useWebSocket } from './useWebSocket';
import { whatsAppSafetyApi } from '../services/api';

export type InboxAiSendQueueState = {
  queueItemId: string;
  scheduledAt: string;
  secondsRemaining: number;
};

function computeSecondsRemaining(scheduledAt: string): number {
  return Math.max(0, Math.ceil((new Date(scheduledAt).getTime() - Date.now()) / 1000));
}

/** Pending WhatsApp Safety queue delivery for the active chat's AI reply. */
export function useInboxAiSendQueue(
  sessionId: string | undefined,
  chatId: string | undefined,
): InboxAiSendQueueState | null {
  const [queued, setQueued] = useState<InboxAiSendQueueState | null>(null);

  const clearIfExpired = useCallback((state: InboxAiSendQueueState | null) => {
    if (!state) return null;
    if (computeSecondsRemaining(state.scheduledAt) <= 0) return null;
    return state;
  }, []);

  useEffect(() => {
    setQueued(null);
  }, [sessionId, chatId]);

  useWebSocket({
    sessionId: sessionId || undefined,
    sessionEvents: sessionId ? ['ai.sendQueued', 'message.sent'] : undefined,
    onGlobalEvent: (event, sid, data) => {
      if (!chatId || !sessionId || sid !== sessionId) return;
      if (event === 'ai.sendQueued' && data.chatId === chatId) {
        const scheduledAt = String(data.scheduledAt ?? '');
        if (!scheduledAt) return;
        setQueued({
          queueItemId: String(data.queueItemId ?? ''),
          scheduledAt,
          secondsRemaining: computeSecondsRemaining(scheduledAt),
        });
        return;
      }
      if (event === 'message.sent' && data.chatId === chatId) {
        setQueued(null);
      }
    },
  });

  const { data: queueRows = [] } = useQuery({
    queryKey: ['whatsapp-safety', 'queue', 'inbox', sessionId, chatId],
    queryFn: () => whatsAppSafetyApi.listQueue({ sessionId: sessionId! }),
    enabled: Boolean(sessionId && chatId),
    refetchInterval: queued ? false : 10_000,
    staleTime: 5_000,
  });

  useEffect(() => {
    if (queued || !sessionId || !chatId) return;
    const row = queueRows.find(
      r =>
        r.chatId === chatId &&
        ['pending', 'scheduled', 'approval_required'].includes(r.status) &&
        r.source === 'ai',
    );
    if (!row?.scheduledAt) return;
    const next: InboxAiSendQueueState = {
      queueItemId: row.id,
      scheduledAt: row.scheduledAt,
      secondsRemaining: computeSecondsRemaining(row.scheduledAt),
    };
    if (next.secondsRemaining > 0) setQueued(next);
  }, [queueRows, sessionId, chatId, queued]);

  useEffect(() => {
    if (!queued) return;
    const tick = () => {
      setQueued(prev => clearIfExpired(prev));
    };
    tick();
    const id = window.setInterval(tick, 1000);
    return () => window.clearInterval(id);
  }, [queued?.scheduledAt, clearIfExpired]);

  return queued;
}

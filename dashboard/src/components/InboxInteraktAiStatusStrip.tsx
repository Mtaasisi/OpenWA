import { useEffect, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useTranslation } from 'react-i18next';
import { MaterialSymbol } from './MaterialSymbol';
import { inboxApi } from '../services/api';
import { useRole } from '../hooks/useRole';
import { isGroupChat } from '../pages/inbox-helpers';
import {
  isManualTakeoverActive,
  manualTakeoverMinutesRemaining,
} from '../lib/inbox-ai-takeover';

import type { InboxAiSendQueueState } from '../hooks/useInboxAiSendQueue';

interface Props {
  sessionId: string;
  chatId: string;
  aiTyping?: boolean;
  aiSendQueue?: InboxAiSendQueueState | null;
}

export function InboxInteraktAiStatusStrip({ sessionId, chatId, aiTyping, aiSendQueue }: Props) {
  const { t } = useTranslation();
  const { canWrite } = useRole();
  const qc = useQueryClient();
  const [, tick] = useState(0);

  const { data: crm } = useQuery({
    queryKey: ['inbox', 'crm', sessionId, chatId],
    queryFn: () => inboxApi.getThreadCrm(sessionId, chatId),
  });

  const manualTakeover = isManualTakeoverActive(crm);
  const takeoverMinutesLeft = manualTakeoverMinutesRemaining(crm);

  useEffect(() => {
    if (!manualTakeover || takeoverMinutesLeft <= 0) return;
    const timer = window.setInterval(() => tick(n => n + 1), 30_000);
    return () => window.clearInterval(timer);
  }, [manualTakeover, takeoverMinutesLeft]);

  const takeOver = useMutation({
    mutationFn: () =>
      inboxApi.updateThreadCrm({
        sessionId,
        chatId,
        aiAutoReplyPaused: true,
        aiHandlingState: 'human_handling',
        autopilotPauseReason: 'explicit',
      }),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ['inbox', 'crm', sessionId, chatId] });
      void qc.invalidateQueries({ queryKey: ['inbox', 'conversations', 'all'] });
    },
  });

  const resume = useMutation({
    mutationFn: () => inboxApi.resumeAi(sessionId, chatId),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ['inbox', 'crm', sessionId, chatId] });
      void qc.invalidateQueries({ queryKey: ['inbox', 'conversations', 'all'] });
    },
  });

  if (isGroupChat(chatId)) return null;

  const handling = crm?.aiHandlingState ?? 'idle';
  const paused = crm?.aiAutoReplyPaused || crm?.aiOptOut;
  const aiBlocked = handling === 'human_handling' || handling === 'waiting_human' || paused;

  if (aiBlocked) {
    let message = t('inbox.interakt.aiStripPaused');
    if (manualTakeover && takeoverMinutesLeft > 0) {
      message = t('inbox.interakt.aiStripManualTakeover', {
        defaultValue: 'AI paused by manual reply · resumes in {{minutes}} min',
        minutes: takeoverMinutesLeft,
      });
    } else if (handling === 'waiting_human') {
      message = t('inbox.interakt.aiStripNeedsHuman');
    } else if (crm?.aiOptOut) {
      message = t('inbox.aiOptOutResumeHint');
    } else if (handling === 'human_handling') {
      message = t('inbox.interakt.aiStripHumanHandling');
    }

    return (
      <div className="inbox-interakt-ai-strip inbox-interakt-ai-strip--blocked" role="status">
        <MaterialSymbol name="smart_toy" size={18} className="inbox-interakt-ai-strip__icon" />
        <p className="inbox-interakt-ai-strip__text">{message}</p>
        {canWrite && (
          <div className="inbox-interakt-ai-strip__actions">
            <button
              type="button"
              className="inbox-interakt-ai-strip__link"
              disabled={resume.isPending}
              onClick={() => resume.mutate()}
            >
              {t('inbox.aiResume', { defaultValue: 'Resume AI now' })}
            </button>
            {!crm?.aiOptOut && crm?.autopilotPauseReason !== 'explicit' && (
              <button
                type="button"
                className="inbox-interakt-ai-strip__link"
                disabled={takeOver.isPending}
                onClick={() => takeOver.mutate()}
              >
                {t('inbox.interakt.keepPaused', { defaultValue: 'Keep paused' })}
              </button>
            )}
          </div>
        )}
      </div>
    );
  }

  if (handling === 'idle' && !aiTyping && !aiSendQueue) return null;

  let message = t('inbox.interakt.aiStripDrafting');
  if (aiSendQueue && aiSendQueue.secondsRemaining > 0) {
    message = t('inbox.interakt.aiStripQueued', { seconds: aiSendQueue.secondsRemaining });
  } else if (aiTyping) {
    message = t('inbox.interakt.aiStripDrafting');
  } else if (handling === 'ai_handling') {
    message = t('inbox.interakt.aiStripActive');
  }

  return (
    <div className="inbox-interakt-ai-strip" role="status">
      <MaterialSymbol name="psychology" size={18} className="inbox-interakt-ai-strip__icon inbox-interakt-ai-strip__icon--pulse" />
      <p className="inbox-interakt-ai-strip__text">{message}</p>
      {canWrite && (
        <button
          type="button"
          className="inbox-interakt-ai-strip__link"
          disabled={takeOver.isPending}
          onClick={() => takeOver.mutate()}
        >
          {t('inbox.interakt.takeOver')}
        </button>
      )}
    </div>
  );
}

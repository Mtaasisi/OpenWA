import { useMutation, useQueryClient } from '@tanstack/react-query';
import { useTranslation } from 'react-i18next';
import { Bot, Hand, Loader2, UserRound } from 'lucide-react';
import { MaterialSymbol } from './MaterialSymbol';
import { inboxApi, type InboxAiHandlingState, type InboxThreadCrm } from '../services/api';
import { useRole } from '../hooks/useRole';
import './InboxAiHandlingControls.css';

interface InboxAiHandlingControlsProps {
  sessionId: string;
  chatId: string;
  isGroup: boolean;
  crm: InboxThreadCrm | null | undefined;
  className?: string;
  /** Interakt CRM: hide status badge (shown in card header instead). */
  hideBadge?: boolean;
}

function stateLabel(state: InboxAiHandlingState, t: (k: string) => string): string {
  switch (state) {
    case 'ai_handling':
      return t('inbox.aiStateHandling');
    case 'waiting_human':
      return t('inbox.aiStateWaitingHuman');
    case 'human_handling':
      return t('inbox.aiStateHuman');
    default:
      return t('inbox.aiStateIdle');
  }
}

export function InboxAiHandlingControls({
  sessionId,
  chatId,
  isGroup,
  crm,
  className = '',
  hideBadge = false,
}: InboxAiHandlingControlsProps) {
  const { t } = useTranslation();
  const { canWrite } = useRole();
  const qc = useQueryClient();
  const queryKey = ['inbox', 'crm', sessionId, chatId];

  const takeover = useMutation({
    mutationFn: () => inboxApi.takeOverFromAi(sessionId, chatId),
    onSuccess: () => void qc.invalidateQueries({ queryKey }),
  });

  const resume = useMutation({
    mutationFn: () => inboxApi.resumeAi(sessionId, chatId),
    onSuccess: () => void qc.invalidateQueries({ queryKey }),
  });

  if (isGroup) return null;

  const state = crm?.aiHandlingState ?? 'idle';
  const pending = takeover.isPending || resume.isPending;
  const isInterakt = className.includes('interakt');

  return (
    <div className={`inbox-ai-handling ${className}`.trim()}>
      {!hideBadge && (
        <div className={`inbox-ai-handling__badge inbox-ai-handling__badge--${state}`}>
          {isInterakt ? <MaterialSymbol name="smart_toy" size={14} /> : <Bot size={14} aria-hidden />}
          <span>{stateLabel(state, t)}</span>
        </div>
      )}
      {canWrite && (
        <div className="inbox-ai-handling__actions">
          {(state === 'idle' || state === 'ai_handling' || state === 'waiting_human') && (
            <button
              type="button"
              className="inbox-ai-handling__btn"
              disabled={pending}
              onClick={() => takeover.mutate()}
            >
              {pending ? (
                isInterakt ? (
                  <MaterialSymbol name="sync" size={14} spin />
                ) : (
                  <Loader2 className="animate-spin" size={14} />
                )
              ) : isInterakt ? (
                <MaterialSymbol name="back_hand" size={14} />
              ) : (
                <Hand size={14} />
              )}
              {t('inbox.aiTakeOver')}
            </button>
          )}
          {(state === 'human_handling' || state === 'waiting_human' || crm?.aiAutoReplyPaused) && (
            <button
              type="button"
              className="inbox-ai-handling__btn inbox-ai-handling__btn--primary"
              disabled={pending}
              onClick={() => resume.mutate()}
            >
              {pending ? (
                isInterakt ? (
                  <MaterialSymbol name="sync" size={14} spin />
                ) : (
                  <Loader2 className="animate-spin" size={14} />
                )
              ) : isInterakt ? (
                <MaterialSymbol name="smart_toy" size={14} />
              ) : (
                <UserRound size={14} />
              )}
              {t('inbox.aiResume')}
            </button>
          )}
        </div>
      )}
      {crm?.aiOptOut && (
        <p className="inbox-ai-handling__hint">{t('inbox.aiOptOutResumeHint')}</p>
      )}
      {crm?.aiEscalatedAt && state === 'waiting_human' && !crm?.aiOptOut && (
        <p className="inbox-ai-handling__hint">{t('inbox.aiEscalatedHint')}</p>
      )}
    </div>
  );
}

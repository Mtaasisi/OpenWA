import { useMutation, useQueryClient } from '@tanstack/react-query';
import { useTranslation } from 'react-i18next';
import { Bot, Loader2 } from 'lucide-react';
import { MaterialSymbol } from './MaterialSymbol';
import { inboxApi } from '../services/api';
import { useRole } from '../hooks/useRole';
import './InboxAiAutoReplyToggle.css';

interface InboxAiAutoReplyToggleProps {
  sessionId: string;
  chatId: string;
  aiAutoReplyPaused: boolean;
  isGroup: boolean;
  className?: string;
}

export function InboxAiAutoReplyToggle({
  sessionId,
  chatId,
  aiAutoReplyPaused,
  isGroup,
  className = '',
}: InboxAiAutoReplyToggleProps) {
  const { t } = useTranslation();
  const { canWrite } = useRole();
  const qc = useQueryClient();

  const mutation = useMutation({
    mutationFn: (paused: boolean) =>
      inboxApi.updateThreadCrm({
        sessionId,
        chatId,
        aiAutoReplyPaused: paused,
      }),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ['inbox', 'crm', sessionId, chatId] });
    },
  });

  if (isGroup) return null;

  const enabled = !aiAutoReplyPaused;
  const isInterakt = className.includes('interakt');

  return (
    <div className={`inbox-ai-auto-reply-toggle ${className}`.trim()}>
      <label className="inbox-ai-auto-reply-toggle__label">
        {isInterakt ? <MaterialSymbol name="smart_toy" size={15} /> : <Bot size={15} aria-hidden />}
        <span>{t('inbox.aiAutoReplyForChat')}</span>
        <input
          type="checkbox"
          checked={enabled}
          disabled={!canWrite || mutation.isPending}
          onChange={(e) => mutation.mutate(!e.target.checked)}
        />
        {mutation.isPending &&
          (isInterakt ? (
            <MaterialSymbol name="sync" size={14} spin />
          ) : (
            <Loader2 className="animate-spin" size={14} aria-hidden />
          ))}
      </label>
      <p className="inbox-ai-auto-reply-toggle__hint">{t('inbox.aiAutoReplyForChatHint')}</p>
    </div>
  );
}

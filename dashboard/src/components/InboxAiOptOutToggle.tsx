import { useMutation, useQueryClient } from '@tanstack/react-query';
import { useTranslation } from 'react-i18next';
import { UserX, Loader2 } from 'lucide-react';
import { MaterialSymbol } from './MaterialSymbol';
import { inboxApi } from '../services/api';
import { useRole } from '../hooks/useRole';
import './InboxAiAutoReplyToggle.css';

interface InboxAiOptOutToggleProps {
  sessionId: string;
  chatId: string;
  aiOptOut: boolean;
  isGroup: boolean;
  className?: string;
}

export function InboxAiOptOutToggle({
  sessionId,
  chatId,
  aiOptOut,
  isGroup,
  className = '',
}: InboxAiOptOutToggleProps) {
  const { t } = useTranslation();
  const { canWrite } = useRole();
  const qc = useQueryClient();

  const mutation = useMutation({
    mutationFn: (optOut: boolean) =>
      inboxApi.updateThreadCrm({
        sessionId,
        chatId,
        aiOptOut: optOut,
        aiAutoReplyPaused: optOut ? true : undefined,
      }),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ['inbox', 'crm', sessionId, chatId] });
    },
  });

  if (isGroup) return null;

  const isInterakt = className.includes('interakt');

  return (
    <div className={`inbox-ai-auto-reply-toggle ${className}`.trim()}>
      <label className="inbox-ai-auto-reply-toggle__label">
        {isInterakt ? <MaterialSymbol name="person_off" size={15} /> : <UserX size={15} aria-hidden />}
        <span>{t('inbox.aiOptOutForChat')}</span>
        <input
          type="checkbox"
          checked={aiOptOut}
          disabled={!canWrite || mutation.isPending}
          onChange={(e) => mutation.mutate(e.target.checked)}
        />
        {mutation.isPending &&
          (isInterakt ? (
            <MaterialSymbol name="sync" size={14} spin />
          ) : (
            <Loader2 className="animate-spin" size={14} aria-hidden />
          ))}
      </label>
      <p className="inbox-ai-auto-reply-toggle__hint">{t('inbox.aiOptOutForChatHint')}</p>
    </div>
  );
}

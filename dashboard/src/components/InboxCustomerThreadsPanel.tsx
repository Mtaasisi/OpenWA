import { useTranslation } from 'react-i18next';
import { useQuery } from '@tanstack/react-query';
import { Loader2, Users } from 'lucide-react';
import { followupApi, type PipelineCard, type Session } from '../services/api';

interface Props {
  conversationId: string | undefined;
  currentSessionId: string;
  currentChatId: string;
  sessions: Session[];
  onOpenThread: (sessionId: string, chatId: string) => void;
}

function fmtTime(iso: string | null | undefined): string {
  if (!iso) return '—';
  return new Date(iso).toLocaleString(undefined, {
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}

export function InboxCustomerThreadsPanel({
  conversationId,
  currentSessionId,
  currentChatId,
  sessions,
  onOpenThread,
}: Props) {
  const { t } = useTranslation();

  const { data: profile, isLoading } = useQuery({
    queryKey: ['customers', 'profile', conversationId],
    queryFn: () => followupApi.getCustomerProfile(conversationId!),
    enabled: !!conversationId,
  });

  if (!conversationId) return null;

  if (isLoading) {
    return (
      <div className="inbox-customer-threads inbox-customer-threads--loading">
        <Loader2 className="animate-spin" size={16} />
      </div>
    );
  }

  if (!profile || profile.linkedThreadCount <= 1) {
    return (
      <p className="inbox-customer-threads__empty">
        {t('inbox.customer360.noOtherAccounts', { defaultValue: 'No other conversations for this customer.' })}
      </p>
    );
  }

  const sessionById = new Map(sessions.map(s => [s.id, s]));

  const threads = profile.conversations.filter(
    thread =>
      !thread.isManual &&
      thread.sessionId !== 'manual' &&
      !(thread.sessionId === currentSessionId && thread.chatId === currentChatId),
  );

  if (threads.length === 0) {
    return (
      <p className="inbox-customer-threads__empty">
        {t('inbox.customer360.noOtherAccounts', { defaultValue: 'No other conversations for this customer.' })}
      </p>
    );
  }

  return (
    <section className="inbox-customer-threads">
      <h4>
        <Users size={14} /> {t('inbox.customer360.otherAccounts', { defaultValue: 'Other accounts' })}
      </h4>
      <ul className="inbox-customer-threads__list">
        {threads.map((thread: PipelineCard) => {
          const session = sessionById.get(thread.sessionId);
          const lastAt = thread.lastCustomerMessageAt || thread.lastStaffMessageAt;
          return (
            <li key={thread.id} className="inbox-customer-threads__item">
              <div className="inbox-customer-threads__main">
                <strong>{session?.name ?? thread.sessionId}</strong>
                <span className="inbox-customer-threads__meta">
                  {session?.status ?? '—'} · {thread.stage.replace(/_/g, ' ')} ·{' '}
                  {thread.crmResolved ? t('inbox.resolved', { defaultValue: 'Resolved' }) : t('inbox.open', { defaultValue: 'Open' })}
                </span>
                <span className="inbox-customer-threads__time">{fmtTime(lastAt)}</span>
              </div>
              <button
                type="button"
                className="btn btn-ghost btn-sm"
                onClick={() => onOpenThread(thread.sessionId, thread.chatId)}
              >
                {t('inbox.customer360.openChat', { defaultValue: 'Open' })}
              </button>
            </li>
          );
        })}
      </ul>
    </section>
  );
}

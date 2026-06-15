import { Link } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { useQuery } from '@tanstack/react-query';
import { Loader2, Users } from 'lucide-react';
import { followupApi, type PipelineCard } from '../services/api';
import { CustomerAiProfilePanel } from './CustomerAiProfilePanel';

interface Props {
  card: PipelineCard;
  onOpenConversation?: (card: PipelineCard) => void;
}

function fmtActivity(iso: string | null | undefined): string {
  if (!iso) return '—';
  return new Date(iso).toLocaleString(undefined, {
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}

function threadLabel(card: PipelineCard, t: (key: string) => string): string {
  return card.customerName || card.customerHandle || card.customerPhone || t('pipeline.unnamed');
}

export function CustomerProfilePanel({ card, onOpenConversation }: Props) {
  const { t } = useTranslation();

  const { data: profile, isLoading } = useQuery({
    queryKey: ['customers', 'profile', card.id],
    queryFn: () => followupApi.getCustomerProfile(card.id),
  });

  if (isLoading) {
    return (
      <div className="customer-profile customer-profile--loading">
        <Loader2 className="animate-spin" size={18} />
      </div>
    );
  }

  if (!profile) return null;

  const showUnified = profile.linkedThreadCount > 1;

  return (
    <section className="customer-profile">
      <h4>
        <Users size={14} /> {t('customers.profile.title')}
      </h4>

      {showUnified ? (
        <>
          <p className="customer-profile__hint">
            {t('customers.profile.hint', { count: profile.linkedThreadCount })}
          </p>
          <div className="customer-profile__stats">
            <span>{t('customers.profile.open', { count: profile.stats.openLeads })}</span>
            <span>{t('customers.profile.won', { count: profile.stats.wonLeads })}</span>
            <span>{t('customers.profile.lost', { count: profile.stats.lostLeads })}</span>
            <span>{t('customers.profile.activity', { date: fmtActivity(profile.stats.latestActivityAt) })}</span>
          </div>
          <ul className="customer-profile__threads">
            {profile.conversations.map((thread) => {
              const isCurrent = thread.id === card.id;
              const inboxLink =
                !thread.isManual && thread.sessionId !== 'manual'
                  ? `/inbox?session=${thread.sessionId}&chat=${encodeURIComponent(thread.chatId)}`
                  : null;
              return (
                <li
                  key={thread.id}
                  className={`customer-profile__thread${isCurrent ? ' customer-profile__thread--current' : ''}`}
                >
                  <div className="customer-profile__thread-main">
                    <strong>{threadLabel(thread, t)}</strong>
                    {isCurrent && (
                      <span className="customer-profile__current">{t('customers.profile.current')}</span>
                    )}
                    <span className="customer-profile__sub">
                      {thread.stage.replace(/_/g, ' ')} · {thread.sessionId}
                    </span>
                  </div>
                  <div className="customer-profile__thread-actions">
                    {inboxLink && (
                      <Link to={inboxLink} className="btn btn-ghost btn-sm">
                        {t('customers.openChat')}
                      </Link>
                    )}
                    {!isCurrent && onOpenConversation && (
                      <button
                        type="button"
                        className="btn btn-ghost btn-sm"
                        onClick={() => onOpenConversation(thread)}
                      >
                        {t('customers.profile.openLead')}
                      </button>
                    )}
                  </div>
                </li>
              );
            })}
          </ul>
        </>
      ) : (
        <p className="customer-profile__muted">{t('customers.profile.singleThread')}</p>
      )}

      {!card.isManual && card.sessionId !== 'manual' && (
        <CustomerAiProfilePanel sessionId={card.sessionId} chatId={card.chatId} />
      )}
    </section>
  );
}
